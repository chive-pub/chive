'use client';

/**
 * Edit dialog for eprint submissions.
 *
 * @remarks
 * Provides a form dialog for editing eprint metadata such as title,
 * keywords, and optionally replacing the document. Uses the backend
 * authorization endpoint to validate permissions and compute version
 * increments, then makes the actual PDS update via the ATProto agent.
 *
 * Supports structured changelogs with sections organized by category
 * (methodology, results, corrections, etc.) and individual change items.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown, Loader2, Pencil, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { MarkdownEditor } from '@/components/editor';
import { useAgent } from '@/lib/auth/auth-context';
import { authApi } from '@/lib/api/client';
import {
  formatVersion,
  useUpdateEprint,
  type VersionBumpType,
} from '@/lib/hooks/use-eprint-mutations';
import type { SemanticVersion } from '@/lib/api/generated/types/pub/chive/eprint/submission';
import { logger } from '@/lib/observability';
import { cn } from '@/lib/utils';

import { ChangelogForm, type ChangelogFormData } from './changelog-form';
import { VersionSelector } from './version-selector';

const editLogger = logger.child({ component: 'eprint-edit-dialog' });

/**
 * Eprint data required for the edit dialog.
 */
export interface EprintEditData {
  /** AT-URI of the eprint */
  uri: string;
  /** Record key for the eprint */
  rkey: string;
  /** Collection NSID */
  collection: string;
  /** Current title */
  title: string;
  /** Current abstract (plain text) */
  abstract?: string;
  /** Current keywords */
  keywords?: string[];
  /** Current version */
  version?: SemanticVersion;
  /** DID of the repository owner */
  repo: string;
}

/**
 * Props for EprintEditDialog.
 */
export interface EprintEditDialogProps {
  /** Current eprint data to edit */
  eprint: EprintEditData;
  /** Whether the user has permission to edit */
  canEdit: boolean;
  /** Callback invoked after successful edit */
  onSuccess?: () => void;
  /** Optional children to use as trigger */
  children?: React.ReactNode;
}

/**
 * Form validation schema for eprint editing.
 *
 * @remarks
 * Changelog data is managed separately via state rather than react-hook-form
 * to allow the structured ChangelogForm component to handle its own updates.
 */
const editFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300, 'Title must be 300 characters or fewer'),
  abstract: z.string().max(10000, 'Abstract must be 10,000 characters or fewer').optional(),
  keywords: z.string().optional(),
  versionBump: z.enum(['major', 'minor', 'patch']),
  document: z.instanceof(File).optional(),
});

type EditFormValues = z.infer<typeof editFormSchema>;

/**
 * Default empty changelog data.
 */
const EMPTY_CHANGELOG: ChangelogFormData = {
  summary: undefined,
  sections: [],
  reviewerResponse: undefined,
};

/**
 * Edit dialog for eprint submissions.
 *
 * @param props - component props
 * @param props.eprint - current eprint data to edit
 * @param props.canEdit - whether the user has permission to edit
 * @param props.onSuccess - callback invoked after successful edit
 * @param props.children - optional trigger element (defaults to an edit button)
 * @returns React element rendering the edit dialog
 *
 * @example
 * ```tsx
 * <EprintEditDialog
 *   eprint={eprintData}
 *   canEdit={canModify}
 *   onSuccess={handleEditSuccess}
 * >
 *   <Button variant="outline" size="sm">
 *     <Pencil className="h-4 w-4 mr-2" />
 *     Edit
 *   </Button>
 * </EprintEditDialog>
 * ```
 */
export function EprintEditDialog({ eprint, canEdit, onSuccess, children }: EprintEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [changelog, setChangelog] = useState<ChangelogFormData>(EMPTY_CHANGELOG);
  const [changelogExpanded, setChangelogExpanded] = useState(false);

  const agent = useAgent();
  const { mutateAsync: updateEprint } = useUpdateEprint();

  const [abstractExpanded, setAbstractExpanded] = useState(false);

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      title: eprint.title,
      abstract: eprint.abstract ?? '',
      keywords: eprint.keywords?.join(', ') ?? '',
      versionBump: 'patch',
      document: undefined,
    },
  });

  // Reset form and changelog when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        title: eprint.title,
        abstract: eprint.abstract ?? '',
        keywords: eprint.keywords?.join(', ') ?? '',
        versionBump: 'patch',
        document: undefined,
      });
      setSelectedFile(null);
      setChangelog(EMPTY_CHANGELOG);
      setChangelogExpanded(false);
      setAbstractExpanded(false);
    }
  }, [open, eprint.title, eprint.abstract, eprint.keywords, form]);

  /**
   * Handles file selection for document replacement.
   */
  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        setSelectedFile(file);
        form.setValue('document', file);
      }
    },
    [form]
  );

  /**
   * Clears the selected file.
   */
  const clearFile = useCallback(() => {
    setSelectedFile(null);
    form.setValue('document', undefined);
  }, [form]);

  /**
   * Handles form submission.
   *
   * First calls the backend authorization endpoint, then uses the
   * returned version info to make the PDS putRecord call.
   */
  const onSubmit = useCallback(
    async (values: EditFormValues) => {
      if (!agent) {
        toast.error('Not authenticated. Please log in and try again.');
        return;
      }

      setIsSubmitting(true);

      try {
        // Parse keywords from comma-separated string
        const keywords = values.keywords
          ? values.keywords
              .split(',')
              .map((k) => k.trim())
              .filter((k) => k.length > 0)
          : undefined;

        // Build changelog input if any sections or summary provided
        const hasChangelog =
          changelog.summary || changelog.sections.length > 0 || changelog.reviewerResponse;

        const changelogInput = hasChangelog
          ? {
              summary: changelog.summary,
              sections: changelog.sections
                .map((section) => ({
                  category: section.category,
                  items: section.items
                    .filter((item) => item.description.trim())
                    .map((item) => ({
                      description: item.description,
                      changeType: item.changeType,
                      location: item.location,
                      reviewReference: item.reviewReference,
                    })),
                }))
                .filter((section) => section.items.length > 0),
              reviewerResponse: changelog.reviewerResponse,
            }
          : undefined;

        // Step 1: Call backend authorization endpoint
        const authResult = await updateEprint({
          uri: eprint.uri,
          versionBump: values.versionBump,
          title: values.title !== eprint.title ? values.title : undefined,
          keywords,
          changelog: changelogInput,
        });

        editLogger.info('Authorization successful', {
          uri: eprint.uri,
          newVersion: formatVersion(authResult.version),
        });

        // Step 2: Upload new document if provided
        let documentBlobRef = undefined;
        if (selectedFile) {
          const fileBytes = new Uint8Array(await selectedFile.arrayBuffer());
          const uploadResult = await agent.uploadBlob(fileBytes, {
            encoding: selectedFile.type || 'application/pdf',
          });
          documentBlobRef = uploadResult.data.blob;
          editLogger.info('Document uploaded', { cid: documentBlobRef.ref.toString() });
        }

        // Step 3: Fetch current record to merge with updates
        const currentRecord = await agent.com.atproto.repo.getRecord({
          repo: eprint.repo,
          collection: eprint.collection,
          rkey: eprint.rkey,
        });

        // Step 4: Build updated record
        const currentRecordValue = currentRecord.data.value as Record<string, unknown>;
        const updatedRecord = {
          ...currentRecordValue,
          title: values.title,
          abstract: values.abstract ?? currentRecordValue.abstract,
          keywords: keywords ?? currentRecordValue.keywords,
          version: authResult.version,
          ...(documentBlobRef && { document: documentBlobRef }),
        };

        // Step 5: Make PDS putRecord call with optimistic concurrency control
        await agent.com.atproto.repo.putRecord({
          repo: eprint.repo,
          collection: eprint.collection,
          rkey: eprint.rkey,
          record: updatedRecord,
          swapRecord: authResult.expectedCid,
        });

        // Request immediate re-indexing as a UX optimization.
        // The firehose is the primary indexing mechanism, but there may be latency.
        // This call ensures the record appears immediately in Chive's index.
        try {
          await authApi.pub.chive.sync.indexRecord({ uri: eprint.uri });
        } catch {
          editLogger.warn('Immediate re-indexing failed; firehose will handle', {
            uri: eprint.uri,
          });
        }

        toast.success('Eprint updated successfully', {
          description: `Version ${formatVersion(authResult.version)}`,
        });

        setOpen(false);
        onSuccess?.();
      } catch (error) {
        editLogger.error('Failed to update eprint', error);

        // Handle specific error types
        if (error instanceof Error) {
          if (error.message.includes('swapRecord')) {
            toast.error('Update conflict', {
              description: 'The eprint was modified by someone else. Please refresh and try again.',
            });
          } else if (error.message.includes('Unauthorized')) {
            toast.error('Not authorized to edit this eprint');
          } else {
            toast.error('Failed to update eprint', {
              description: error.message,
            });
          }
        } else {
          toast.error('Failed to update eprint');
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [agent, changelog, eprint, selectedFile, updateEprint, onSuccess]
  );

  const currentVersion = eprint.version ? formatVersion(eprint.version) : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" disabled={!canEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Eprint</DialogTitle>
          <DialogDescription>
            Update the metadata for this eprint. Changes will be saved to your PDS and propagated to
            all indexers.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Title field with Markdown/LaTeX support */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <MarkdownEditor
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Enter eprint title. Use $...$ for LaTeX math symbols."
                      maxLength={300}
                      minHeight="60px"
                      enablePreview={true}
                      showToolbar={false}
                      showPreviewToggle={true}
                      enableMentions={true}
                      enableTags={true}
                      disabled={isSubmitting}
                      ariaLabel="Title editor"
                    />
                  </FormControl>
                  <FormDescription>Supports LaTeX, @ mentions, and # tags</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Abstract field (collapsible) */}
            <Collapsible open={abstractExpanded} onOpenChange={setAbstractExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="flex w-full items-center justify-between"
                >
                  <span>Edit Abstract</span>
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform', abstractExpanded && 'rotate-180')}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <FormField
                  control={form.control}
                  name="abstract"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Abstract</FormLabel>
                      <FormControl>
                        <MarkdownEditor
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          placeholder="Enter the abstract. Use $...$ for inline LaTeX and $$...$$ for display equations."
                          maxLength={10000}
                          minHeight="200px"
                          enablePreview={true}
                          showToolbar={true}
                          enableMentions={true}
                          enableTags={true}
                          disabled={isSubmitting}
                          ariaLabel="Abstract editor"
                        />
                      </FormControl>
                      <FormDescription>
                        Supports Markdown, LaTeX, @ mentions, and # tags.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CollapsibleContent>
            </Collapsible>

            {/* Keywords field */}
            <FormField
              control={form.control}
              name="keywords"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keywords</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter keywords, separated by commas"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Separate multiple keywords with commas (e.g., machine learning, neural networks,
                    NLP)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Version selector */}
            <FormField
              control={form.control}
              name="versionBump"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <VersionSelector
                      value={field.value as VersionBumpType}
                      onChange={field.onChange}
                      currentVersion={currentVersion}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Structured changelog (collapsible) */}
            <Collapsible open={changelogExpanded} onOpenChange={setChangelogExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="flex w-full items-center justify-between"
                >
                  <span>Changelog Details</span>
                  <div className="flex items-center gap-2">
                    {changelog.sections.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {changelog.sections.length}{' '}
                        {changelog.sections.length === 1 ? 'section' : 'sections'}
                      </span>
                    )}
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 transition-transform',
                        changelogExpanded && 'rotate-180'
                      )}
                    />
                  </div>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="rounded-lg border p-4">
                  <ChangelogForm
                    value={changelog}
                    onChange={setChangelog}
                    disabled={isSubmitting}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Document your changes in detail. This helps readers understand what evolved
                  between versions.
                </p>
              </CollapsibleContent>
            </Collapsible>

            {/* Document replacement (optional) */}
            <FormField
              control={form.control}
              name="document"
              render={() => (
                <FormItem>
                  <FormLabel>Replace Document (Optional)</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      {selectedFile ? (
                        <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 text-sm truncate">{selectedFile.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={clearFile}
                            disabled={isSubmitting}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-4 w-4" />
                            <span className="sr-only">Remove file</span>
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept=".pdf,.docx,.doc,.html,.md,.tex,.ipynb"
                            onChange={handleFileChange}
                            disabled={isSubmitting}
                            className="cursor-pointer"
                          />
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>
                    Upload a new document to replace the current one. Supported formats: PDF, DOCX,
                    HTML, Markdown, LaTeX, Jupyter Notebook.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
