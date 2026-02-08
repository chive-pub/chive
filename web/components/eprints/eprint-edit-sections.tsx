'use client';

/**
 * Collapsible edit sections for all eprint fields.
 *
 * @remarks
 * Provides a comprehensive editing interface where users can expand
 * and edit any section of an eprint without stepping through a wizard.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ChevronDown,
  FileText,
  Users,
  Tags,
  BookOpen,
  Link as LinkIcon,
  Database,
  DollarSign,
  Calendar,
  Paperclip,
  Save,
  Loader2,
  Upload,
  X,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MarkdownEditor } from '@/components/editor';
import {
  FieldSearch,
  type FieldSelection,
  DoiAutocomplete,
  type CrossRefWork,
  JournalAutocomplete,
  type CrossRefJournal,
  EprintAuthorEditor,
  type EprintAuthorFormData,
  NodeAutocomplete,
  type NodeSuggestion,
  FunderAutocomplete,
  type FunderResult,
  ConferenceAutocomplete,
  type Conference,
  LocationAutocomplete,
  type LocationResult,
} from '@/components/forms';
import { useAuth } from '@/lib/auth/auth-context';
import { VersionSelector } from './version-selector';
import { ChangelogForm, type ChangelogFormData } from './changelog-form';
import { cn } from '@/lib/utils';
import { useAgent } from '@/lib/auth/auth-context';
import {
  formatVersion,
  useUpdateEprint,
  type VersionBumpType,
  type AuthorContribution,
} from '@/lib/hooks/use-eprint-mutations';
import { useContributionTypeNodes } from '@/lib/hooks/use-nodes';
import type { Eprint } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

export interface EprintEditSectionsProps {
  /** The eprint to edit */
  eprint: Eprint;
  /** Section to auto-expand on load */
  initialSection?: string | null;
  /** Callback on successful save */
  onSaveSuccess?: () => void;
  /** Callback on cancel */
  onCancel?: () => void;
  /** Whether save is in progress */
  isSaving: boolean;
  /** Set saving state */
  setIsSaving: (saving: boolean) => void;
}

// Field node reference schema
const fieldNodeSchema = z.object({
  uri: z.string(),
  label: z.string(),
});

// Node selection schema (for NodeAutocomplete values)
const nodeSelectionSchema = z
  .object({
    uri: z.string(),
    label: z.string(),
  })
  .nullable()
  .optional();

// Funding source schema
const fundingSourceSchema = z.object({
  funderName: z.string().min(1, 'Funder name is required'),
  funderUri: z.string().optional(),
  funderDoi: z.string().optional(),
  funderRor: z.string().optional(),
  grantNumber: z.string().optional(),
});

// Conference presentation schema
const conferencePresentationSchema = z
  .object({
    conferenceName: z.string().optional(),
    conferenceUri: z.string().optional(),
    conferenceUrl: z.string().url().optional().or(z.literal('')),
    conferenceIteration: z.string().optional(),
    conferenceLocation: z.string().optional(),
    presentationDate: z.string().optional(),
    presentationTypeUri: z.string().optional(),
    presentationTypeName: z.string().optional(),
  })
  .optional();

// Form schema for the edit form
const editFormSchema = z.object({
  // Basic info
  title: z.string().min(1, 'Title is required').max(500, 'Title must be 500 characters or fewer'),
  abstract: z.string().max(10000, 'Abstract must be 10,000 characters or fewer').optional(),
  keywords: z.string().optional(),

  // Classification
  fieldNodes: z.array(fieldNodeSchema).min(1, 'At least one field is required').max(10).optional(),

  // Publication info (now using node selections with URI and label)
  licenseNode: nodeSelectionSchema,
  publicationStatusNode: nodeSelectionSchema,
  paperTypeNode: nodeSelectionSchema,

  // Keep slugs as fallback for display when no URI is available
  licenseSlug: z.string().optional(),
  publicationStatusSlug: z.string().optional(),
  paperTypeSlug: z.string().optional(),

  // Published version
  publishedDoi: z.string().optional(),
  publishedUrl: z.string().url().optional().or(z.literal('')),
  publishedJournal: z.string().optional(),
  publishedVolume: z.string().optional(),
  publishedIssue: z.string().optional(),
  publishedPages: z.string().optional(),

  // External IDs
  arxivId: z.string().optional(),
  pmid: z.string().optional(),
  pmcid: z.string().optional(),

  // Repositories
  codeRepoUrl: z.string().url().optional().or(z.literal('')),
  dataRepoUrl: z.string().url().optional().or(z.literal('')),

  // Funding sources
  funding: z.array(fundingSourceSchema).optional(),

  // Conference presentation
  conferencePresentation: conferencePresentationSchema,

  // Version
  versionBump: z.enum(['major', 'minor', 'patch']),
});

type EditFormValues = z.infer<typeof editFormSchema>;

// Section configuration
interface SectionConfig {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
}

const SECTIONS: SectionConfig[] = [
  {
    id: 'basic',
    title: 'Basic Information',
    icon: <FileText className="h-5 w-5" />,
    description: 'Title, abstract, and keywords',
  },
  {
    id: 'authors',
    title: 'Authors',
    icon: <Users className="h-5 w-5" />,
    description: 'Author list, affiliations, and contributions',
  },
  {
    id: 'classification',
    title: 'Classification',
    icon: <Tags className="h-5 w-5" />,
    description: 'Academic fields and topics',
  },
  {
    id: 'publication',
    title: 'Publication Status',
    icon: <BookOpen className="h-5 w-5" />,
    description: 'License, status, and paper type',
  },
  {
    id: 'published',
    title: 'Published Version',
    icon: <LinkIcon className="h-5 w-5" />,
    description: 'DOI, journal, and publication details',
  },
  {
    id: 'external',
    title: 'External Identifiers',
    icon: <Database className="h-5 w-5" />,
    description: 'arXiv, PubMed, and other IDs',
  },
  {
    id: 'repositories',
    title: 'Code & Data',
    icon: <Database className="h-5 w-5" />,
    description: 'Code and data repository links',
  },
  {
    id: 'funding',
    title: 'Funding',
    icon: <DollarSign className="h-5 w-5" />,
    description: 'Funding sources and grants',
  },
  {
    id: 'conference',
    title: 'Conference Presentation',
    icon: <Calendar className="h-5 w-5" />,
    description: 'Conference where this work was presented',
  },
  {
    id: 'document',
    title: 'Document',
    icon: <Paperclip className="h-5 w-5" />,
    description: 'Replace the main document',
  },
  {
    id: 'version',
    title: 'Version & Changelog',
    icon: <Calendar className="h-5 w-5" />,
    description: 'Version bump and change notes',
  },
];

// Default changelog
const EMPTY_CHANGELOG: ChangelogFormData = {
  summary: undefined,
  sections: [],
  reviewerResponse: undefined,
};

// =============================================================================
// COMPONENT
// =============================================================================

export function EprintEditSections({
  eprint,
  initialSection,
  onSaveSuccess,
  onCancel,
  isSaving,
  setIsSaving,
}: EprintEditSectionsProps) {
  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (initialSection) {
      initial.add(initialSection);
    }
    return initial;
  });

  // Document replacement
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Changelog state
  const [changelog, setChangelog] = useState<ChangelogFormData>(EMPTY_CHANGELOG);

  // Fetch contribution types from knowledge graph
  const { data: contributionTypesData } = useContributionTypeNodes();

  // Build lookup maps for contribution type resolution
  const contributionTypesByUri = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    if (contributionTypesData?.nodes) {
      for (const node of contributionTypesData.nodes) {
        map.set(node.uri, { id: node.metadata?.slug ?? node.id, label: node.label });
      }
    }
    return map;
  }, [contributionTypesData]);

  const contributionTypesBySlug = useMemo(() => {
    const map = new Map<string, { uri: string; label: string }>();
    if (contributionTypesData?.nodes) {
      for (const node of contributionTypesData.nodes) {
        const slug = node.metadata?.slug ?? node.id;
        map.set(slug, { uri: node.uri, label: node.label });
      }
    }
    return map;
  }, [contributionTypesData]);

  // Convert graph nodes to ContributionType format for EprintAuthorEditor
  const contributionTypes = useMemo(() => {
    if (!contributionTypesData?.nodes) return undefined;
    return contributionTypesData.nodes.map((node) => ({
      uri: node.uri,
      id: node.metadata?.slug ?? node.id,
      label: node.label,
      description: node.description ?? '',
      status: node.status as 'established' | 'provisional' | 'deprecated',
    }));
  }, [contributionTypesData]);

  // Helper to resolve contribution type label from URI or slug
  const resolveContributionLabel = useCallback(
    (typeUri: string | undefined, typeSlug: string | undefined): string => {
      // First try URI lookup
      if (typeUri) {
        const byUri = contributionTypesByUri.get(typeUri);
        if (byUri) return byUri.label;
      }
      // Then try slug lookup
      if (typeSlug) {
        const bySlug = contributionTypesBySlug.get(typeSlug);
        if (bySlug) return bySlug.label;
        // Fallback: format slug as label
        return typeSlug
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
      return 'Unknown';
    },
    [contributionTypesByUri, contributionTypesBySlug]
  );

  // Helper to resolve contribution type ID from URI or slug
  const resolveContributionId = useCallback(
    (typeUri: string | undefined, typeSlug: string | undefined): string => {
      // First try URI lookup
      if (typeUri) {
        const byUri = contributionTypesByUri.get(typeUri);
        if (byUri) return byUri.id;
      }
      // Then try slug lookup (it is the id)
      if (typeSlug) {
        return typeSlug;
      }
      return '';
    },
    [contributionTypesByUri]
  );

  // Authors state (managed separately from form - backend API expansion needed)
  // Use useMemo to update labels when contribution types are fetched
  const initialAuthors = useMemo(
    () =>
      eprint.authors.map((author) => ({
        did: author.did,
        name: author.name || author.displayName || 'Unknown',
        handle: author.handle,
        avatar: author.avatar,
        orcid: author.orcid,
        email: undefined,
        order: author.order,
        affiliations: (author.affiliations ?? []).map((aff) => ({
          name: aff.name,
          rorId: aff.rorId,
          department: aff.department,
        })),
        contributions: (author.contributions ?? []).map((contrib) => ({
          typeUri: contrib.typeUri,
          typeId: resolveContributionId(contrib.typeUri, contrib.typeSlug),
          typeLabel: resolveContributionLabel(contrib.typeUri, contrib.typeSlug),
          degree: contrib.degreeSlug as 'lead' | 'equal' | 'supporting',
        })),
        isCorrespondingAuthor: author.isCorrespondingAuthor,
        isHighlighted: false,
      })),
    [eprint.authors, resolveContributionId, resolveContributionLabel]
  );

  const [authors, setAuthors] = useState<EprintAuthorFormData[]>(initialAuthors);

  // Update authors when contribution types are loaded (for label resolution)
  useEffect(() => {
    if (contributionTypesData?.nodes && contributionTypesData.nodes.length > 0) {
      setAuthors((prev) =>
        prev.map((author) => ({
          ...author,
          contributions: author.contributions.map((contrib) => ({
            ...contrib,
            typeId: resolveContributionId(contrib.typeUri, contrib.typeId),
            typeLabel: resolveContributionLabel(contrib.typeUri, contrib.typeId),
          })),
        }))
      );
    }
  }, [contributionTypesData, resolveContributionId, resolveContributionLabel]);

  const { user } = useAuth();

  const agent = useAgent();
  const { mutateAsync: updateEprint } = useUpdateEprint();

  // Helper to format slug to display label
  const formatSlugToLabel = (slug: string): string => {
    return slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Initialize form with eprint data
  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      title: eprint.title,
      abstract: eprint.abstract ?? '',
      keywords: eprint.keywords?.join(', ') ?? '',
      fieldNodes: eprint.fields?.map((f) => ({ uri: f.uri, label: f.label })) ?? [],
      // Initialize node selections from existing URIs or create fallback from slugs
      licenseNode: eprint.licenseUri
        ? {
            uri: eprint.licenseUri,
            label: eprint.license ?? formatSlugToLabel(eprint.licenseSlug ?? ''),
          }
        : eprint.licenseSlug
          ? { uri: eprint.licenseSlug, label: formatSlugToLabel(eprint.licenseSlug) }
          : null,
      publicationStatusNode: eprint.publicationStatusUri
        ? {
            uri: eprint.publicationStatusUri,
            label: formatSlugToLabel(eprint.publicationStatusSlug ?? ''),
          }
        : eprint.publicationStatusSlug
          ? {
              uri: eprint.publicationStatusSlug,
              label: formatSlugToLabel(eprint.publicationStatusSlug),
            }
          : null,
      paperTypeNode: eprint.paperTypeUri
        ? { uri: eprint.paperTypeUri, label: formatSlugToLabel(eprint.paperTypeSlug ?? '') }
        : eprint.paperTypeSlug
          ? { uri: eprint.paperTypeSlug, label: formatSlugToLabel(eprint.paperTypeSlug) }
          : null,
      // Keep slugs as fallback
      licenseSlug: eprint.licenseSlug ?? '',
      publicationStatusSlug: eprint.publicationStatusSlug ?? '',
      paperTypeSlug: eprint.paperTypeSlug ?? '',
      publishedDoi: eprint.publishedVersion?.doi ?? '',
      publishedUrl: eprint.publishedVersion?.url ?? '',
      publishedJournal: eprint.publishedVersion?.journal ?? '',
      publishedVolume: eprint.publishedVersion?.volume ?? '',
      publishedIssue: eprint.publishedVersion?.issue ?? '',
      publishedPages: eprint.publishedVersion?.pages ?? '',
      arxivId: eprint.externalIds?.arxivId ?? '',
      pmid: eprint.externalIds?.pmid ?? '',
      pmcid: eprint.externalIds?.pmcid ?? '',
      codeRepoUrl: eprint.repositories?.code?.[0]?.url ?? '',
      dataRepoUrl: eprint.repositories?.data?.[0]?.url ?? '',
      // Initialize funding from eprint
      funding:
        eprint.funding?.map((f) => ({
          funderName: f.funderName ?? '',
          funderUri: f.funderUri ?? '',
          funderDoi: f.funderDoi ?? '',
          funderRor: f.funderRor ?? '',
          grantNumber: f.grantNumber ?? '',
        })) ?? [],
      // Initialize conference presentation from eprint
      conferencePresentation: eprint.conferencePresentation
        ? {
            conferenceName: eprint.conferencePresentation.conferenceName ?? '',
            conferenceUri: eprint.conferencePresentation.conferenceUri ?? '',
            conferenceUrl: eprint.conferencePresentation.conferenceUrl ?? '',
            conferenceIteration: '', // Not stored in current schema, user can fill in
            conferenceLocation: eprint.conferencePresentation.conferenceLocation ?? '',
            presentationDate: eprint.conferencePresentation.presentationDate ?? '',
            presentationTypeUri: '', // Would need to look up from slug if needed
            presentationTypeName: eprint.conferencePresentation.presentationTypeSlug
              ? formatSlugToLabel(eprint.conferencePresentation.presentationTypeSlug)
              : '',
          }
        : undefined,
      versionBump: 'patch',
    },
  });

  // Toggle section expansion
  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // Expand all sections
  const expandAll = useCallback(() => {
    setExpandedSections(new Set(SECTIONS.map((s) => s.id)));
  }, []);

  // Collapse all sections
  const collapseAll = useCallback(() => {
    setExpandedSections(new Set());
  }, []);

  // Handle file selection
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  }, []);

  // Clear selected file
  const clearFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  // Field handlers
  const fieldNodes = form.watch('fieldNodes') ?? [];

  const handleFieldAdd = useCallback(
    (field: FieldSelection) => {
      const current = form.getValues('fieldNodes') ?? [];
      form.setValue('fieldNodes', [...current, { uri: field.uri, label: field.label }], {
        shouldValidate: true,
      });
    },
    [form]
  );

  const handleFieldRemove = useCallback(
    (field: FieldSelection) => {
      const current = form.getValues('fieldNodes') ?? [];
      form.setValue(
        'fieldNodes',
        current.filter((f) => f.uri !== field.uri),
        { shouldValidate: true }
      );
    },
    [form]
  );

  // DOI autocomplete handler - auto-fills related fields
  const handleDoiSelect = useCallback(
    (work: CrossRefWork) => {
      form.setValue('publishedDoi', work.doi);
      if (work.url) {
        form.setValue('publishedUrl', work.url);
      }
      if (work.journal) {
        form.setValue('publishedJournal', work.journal);
      }
      if (work.volume) {
        form.setValue('publishedVolume', work.volume);
      }
      if (work.issue) {
        form.setValue('publishedIssue', work.issue);
      }
      if (work.pages) {
        form.setValue('publishedPages', work.pages);
      }
    },
    [form]
  );

  // Journal autocomplete handler
  const handleJournalSelect = useCallback(
    (journal: CrossRefJournal) => {
      form.setValue('publishedJournal', journal.title);
    },
    [form]
  );

  // Funding field array
  const fundingArray = useFieldArray({
    control: form.control,
    name: 'funding',
  });

  // Add funding source
  const handleAddFunding = useCallback(() => {
    fundingArray.append({
      funderName: '',
      funderUri: '',
      funderDoi: '',
      funderRor: '',
      grantNumber: '',
    });
  }, [fundingArray]);

  // Handle funder selection
  const handleFunderSelect = useCallback(
    (funder: FunderResult, index: number) => {
      form.setValue(`funding.${index}.funderName`, funder.name, { shouldValidate: true });
      if (funder.type === 'chive') {
        form.setValue(`funding.${index}.funderUri`, funder.uri, { shouldValidate: true });
        if (funder.rorId) {
          form.setValue(`funding.${index}.funderRor`, funder.rorId, { shouldValidate: true });
        }
      } else {
        form.setValue(`funding.${index}.funderDoi`, funder.doi, { shouldValidate: true });
      }
    },
    [form]
  );

  // Conference handlers
  const handleConferenceSelect = useCallback(
    (conference: Conference) => {
      form.setValue('conferencePresentation.conferenceName', conference.name, {
        shouldValidate: true,
      });
      if (conference.type === 'chive') {
        form.setValue('conferencePresentation.conferenceUri', conference.uri, {
          shouldValidate: true,
        });
      } else if (conference.url) {
        form.setValue('conferencePresentation.conferenceUrl', conference.url, {
          shouldValidate: true,
        });
      }
    },
    [form]
  );

  const handleConferenceClear = useCallback(() => {
    form.setValue('conferencePresentation.conferenceName', '', { shouldValidate: true });
    form.setValue('conferencePresentation.conferenceUri', '', { shouldValidate: true });
    form.setValue('conferencePresentation.conferenceUrl', '', { shouldValidate: true });
  }, [form]);

  const handleLocationSelect = useCallback(
    (location: LocationResult) => {
      form.setValue('conferencePresentation.conferenceLocation', location.displayName, {
        shouldValidate: true,
      });
    },
    [form]
  );

  const handleLocationClear = useCallback(() => {
    form.setValue('conferencePresentation.conferenceLocation', '', { shouldValidate: true });
  }, [form]);

  const handlePresentationTypeSelect = useCallback(
    (node: NodeSuggestion) => {
      form.setValue('conferencePresentation.presentationTypeUri', node.uri, {
        shouldValidate: true,
      });
      form.setValue('conferencePresentation.presentationTypeName', node.label, {
        shouldValidate: true,
      });
    },
    [form]
  );

  const handlePresentationTypeClear = useCallback(() => {
    form.setValue('conferencePresentation.presentationTypeUri', '', { shouldValidate: true });
    form.setValue('conferencePresentation.presentationTypeName', '', { shouldValidate: true });
  }, [form]);

  // Handle form submission
  const onSubmit = useCallback(
    async (data: EditFormValues) => {
      if (!agent) {
        toast.error('You must be signed in to edit');
        return;
      }

      setIsSaving(true);

      try {
        // Parse keywords
        const keywords = data.keywords
          ? data.keywords
              .split(',')
              .map((k) => k.trim())
              .filter(Boolean)
          : undefined;

        // Build update payload
        const updates: Record<string, unknown> = {
          title: data.title,
          keywords,
        };

        // Only include changed fields
        if (data.abstract && data.abstract !== eprint.abstract) {
          updates.abstract = data.abstract;
        }

        // External IDs
        if (data.arxivId || data.pmid || data.pmcid) {
          updates.externalIds = {
            ...(data.arxivId && { arxivId: data.arxivId }),
            ...(data.pmid && { pmid: data.pmid }),
            ...(data.pmcid && { pmcid: data.pmcid }),
          };
        }

        // Published version
        if (data.publishedDoi || data.publishedJournal) {
          updates.publishedVersion = {
            ...(data.publishedDoi && { doi: data.publishedDoi }),
            ...(data.publishedUrl && { url: data.publishedUrl }),
            ...(data.publishedJournal && { journal: data.publishedJournal }),
            ...(data.publishedVolume && { volume: data.publishedVolume }),
            ...(data.publishedIssue && { issue: data.publishedIssue }),
            ...(data.publishedPages && { pages: data.publishedPages }),
          };
        }

        // Repositories - store for future API expansion
        const repositories: { code?: { url: string }[]; data?: { url: string }[] } = {};
        if (data.codeRepoUrl) {
          repositories.code = [{ url: data.codeRepoUrl }];
        }
        if (data.dataRepoUrl) {
          repositories.data = [{ url: data.dataRepoUrl }];
        }

        // Get field URIs from form
        const fieldUris = data.fieldNodes?.map((f) => f.uri);

        // Transform form authors to API AuthorContribution type
        const authorsPayload: AuthorContribution[] = authors.map((author) => ({
          did: author.did,
          name: author.name,
          handle: author.handle,
          orcid: author.orcid,
          email: author.email,
          order: author.order,
          affiliations: author.affiliations?.map((aff) => ({
            name: aff.name,
            rorId: aff.rorId,
            department: aff.department,
          })),
          contributions: author.contributions?.map((contrib) => ({
            typeUri: contrib.typeUri,
            typeSlug: contrib.typeId,
            degreeSlug: contrib.degree ?? 'equal',
          })),
          isCorrespondingAuthor: author.isCorrespondingAuthor ?? false,
          isHighlighted: author.isHighlighted ?? false,
        }));

        // Note: The current API supports title, keywords, fieldUris, authors, versionBump, and changelog.
        // Additional fields (abstract, external IDs, repositories, etc.) would require
        // backend API expansion.
        await updateEprint({
          uri: eprint.uri,
          versionBump: data.versionBump as VersionBumpType,
          title: data.title,
          keywords,
          fieldUris,
          authors: authorsPayload,
          changelog:
            changelog.summary || changelog.sections.length > 0
              ? {
                  summary: changelog.summary,
                  sections: changelog.sections,
                }
              : undefined,
        });

        onSaveSuccess?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update eprint');
      } finally {
        setIsSaving(false);
      }
    },
    [agent, eprint, changelog, updateEprint, onSaveSuccess, setIsSaving, authors]
  );

  const currentVersion = formatVersion(eprint.version);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Quick actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={expandAll}>
              Expand All
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={collapseAll}>
              Collapse All
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {/* Basic Information */}
          <EditSection
            config={SECTIONS[0]}
            expanded={expandedSections.has('basic')}
            onToggle={() => toggleSection('basic')}
          >
            <div className="space-y-4">
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
                        placeholder="Enter eprint title. Use $...$ for LaTeX."
                        maxLength={500}
                        minHeight="60px"
                        enablePreview={true}
                        showToolbar={false}
                        enableMentions={true}
                        enableTags={true}
                        disabled={isSaving}
                        ariaLabel="Title editor"
                      />
                    </FormControl>
                    <FormDescription>Supports LaTeX, @ mentions, and # tags</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        placeholder="Enter the abstract..."
                        maxLength={10000}
                        minHeight="200px"
                        enablePreview={true}
                        showToolbar={true}
                        enableMentions={true}
                        enableTags={true}
                        disabled={isSaving}
                        ariaLabel="Abstract editor"
                      />
                    </FormControl>
                    <FormDescription>
                      Supports Markdown and LaTeX. Use @ to mention users and # for tags.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        disabled={isSaving}
                      />
                    </FormControl>
                    <FormDescription>
                      Separate keywords with commas (e.g., machine learning, NLP)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </EditSection>

          {/* Authors */}
          <EditSection
            config={SECTIONS[1]}
            expanded={expandedSections.has('authors')}
            onToggle={() => toggleSection('authors')}
          >
            <EprintAuthorEditor
              authors={authors}
              onChange={setAuthors}
              submitterDid={user?.did}
              contributionTypes={contributionTypes}
              maxAuthors={50}
              disabled={isSaving}
            />
          </EditSection>

          {/* Classification */}
          <EditSection
            config={SECTIONS[2]}
            expanded={expandedSections.has('classification')}
            onToggle={() => toggleSection('classification')}
          >
            <div className="space-y-4">
              <FieldSearch
                selectedFields={fieldNodes.map((f) => ({ uri: f.uri, label: f.label }))}
                onFieldAdd={handleFieldAdd}
                onFieldRemove={handleFieldRemove}
                maxFields={10}
                label="Research Fields"
                helpText="Select 1-10 fields that describe your research area"
                placeholder="Search for a research field..."
                disabled={isSaving}
              />
              {form.formState.errors.fieldNodes && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.fieldNodes.message}
                </p>
              )}
            </div>
          </EditSection>

          {/* Publication Status */}
          <EditSection
            config={SECTIONS[3]}
            expanded={expandedSections.has('publication')}
            onToggle={() => toggleSection('publication')}
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="licenseNode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>License</FormLabel>
                      <FormControl>
                        <NodeAutocomplete
                          kind="object"
                          subkind="license"
                          label="License"
                          value={field.value?.uri}
                          onSelect={(node: NodeSuggestion) => {
                            field.onChange({ uri: node.uri, label: node.label });
                            // Also update the slug for backward compatibility
                            const slug = node.uri.split('/').pop() ?? node.label;
                            form.setValue('licenseSlug', slug);
                          }}
                          onClear={() => {
                            field.onChange(null);
                            form.setValue('licenseSlug', '');
                          }}
                          placeholder="Search licenses..."
                          disabled={isSaving}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="publicationStatusNode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <FormControl>
                        <NodeAutocomplete
                          kind="object"
                          subkind="publication-status"
                          label="Status"
                          value={field.value?.uri}
                          onSelect={(node: NodeSuggestion) => {
                            field.onChange({ uri: node.uri, label: node.label });
                            // Also update the slug for backward compatibility
                            const slug = node.uri.split('/').pop() ?? node.label;
                            form.setValue('publicationStatusSlug', slug);
                          }}
                          onClear={() => {
                            field.onChange(null);
                            form.setValue('publicationStatusSlug', '');
                          }}
                          placeholder="Search status..."
                          disabled={isSaving}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paperTypeNode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paper Type</FormLabel>
                      <FormControl>
                        <NodeAutocomplete
                          kind="type"
                          subkind="paper-type"
                          label="Paper Type"
                          value={field.value?.uri}
                          onSelect={(node: NodeSuggestion) => {
                            field.onChange({ uri: node.uri, label: node.label });
                            // Also update the slug for backward compatibility
                            const slug = node.uri.split('/').pop() ?? node.label;
                            form.setValue('paperTypeSlug', slug);
                          }}
                          onClear={() => {
                            field.onChange(null);
                            form.setValue('paperTypeSlug', '');
                          }}
                          placeholder="Search paper types..."
                          disabled={isSaving}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </EditSection>

          {/* Published Version */}
          <EditSection
            config={SECTIONS[4]}
            expanded={expandedSections.has('published')}
            onToggle={() => toggleSection('published')}
          >
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="publishedDoi"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DOI</FormLabel>
                    <FormControl>
                      <DoiAutocomplete
                        value={field.value}
                        onSelect={handleDoiSelect}
                        onChange={field.onChange}
                        onClear={() => field.onChange('')}
                        placeholder="Search by title or DOI..."
                        disabled={isSaving}
                      />
                    </FormControl>
                    <FormDescription>
                      Search by title or DOI to auto-fill publication details
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="publishedUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Publisher URL</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://..." disabled={isSaving} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="publishedJournal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Journal/Conference</FormLabel>
                      <FormControl>
                        <JournalAutocomplete
                          value={field.value}
                          onSelect={handleJournalSelect}
                          onChange={field.onChange}
                          onClear={() => field.onChange('')}
                          placeholder="Search journals..."
                          disabled={isSaving}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="publishedVolume"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Volume</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="12" disabled={isSaving} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="publishedIssue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="3" disabled={isSaving} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="publishedPages"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pages</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="123-145" disabled={isSaving} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </EditSection>

          {/* External Identifiers */}
          <EditSection
            config={SECTIONS[5]}
            expanded={expandedSections.has('external')}
            onToggle={() => toggleSection('external')}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="arxivId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>arXiv ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="2301.00000" disabled={isSaving} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pmid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PubMed ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="12345678" disabled={isSaving} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pmcid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PMC ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="PMC1234567" disabled={isSaving} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </EditSection>

          {/* Repositories */}
          <EditSection
            config={SECTIONS[6]}
            expanded={expandedSections.has('repositories')}
            onToggle={() => toggleSection('repositories')}
          >
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="codeRepoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code Repository</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://github.com/..." disabled={isSaving} />
                    </FormControl>
                    <FormDescription>GitHub, GitLab, or other code hosting URL</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dataRepoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Repository</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://zenodo.org/..." disabled={isSaving} />
                    </FormControl>
                    <FormDescription>
                      Zenodo, Figshare, Dryad, or other data repository
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </EditSection>

          {/* Funding */}
          <EditSection
            config={SECTIONS[7]}
            expanded={expandedSections.has('funding')}
            onToggle={() => toggleSection('funding')}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Acknowledge funding sources and grants.
                </p>
                <Button type="button" variant="outline" size="sm" onClick={handleAddFunding}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Funding
                </Button>
              </div>

              {fundingArray.fields.length > 0 ? (
                <div className="space-y-4">
                  {fundingArray.fields.map((field, index) => (
                    <div key={field.id} className="flex gap-3 items-start p-4 border rounded-lg">
                      <div className="flex-1 grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`funding-funder-${index}`}>Funder Name</Label>
                          <FunderAutocomplete
                            id={`funding-funder-${index}`}
                            value={form.watch(`funding.${index}.funderName`)}
                            placeholder="Search funding organizations..."
                            onSelect={(funder) => handleFunderSelect(funder, index)}
                            onClear={() => form.setValue(`funding.${index}.funderName`, '')}
                            disabled={isSaving}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`funding-grant-${index}`}>Grant Number</Label>
                          <Input
                            id={`funding-grant-${index}`}
                            placeholder="R01-GM123456"
                            {...form.register(`funding.${index}.grantNumber`)}
                            disabled={isSaving}
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => fundingArray.remove(index)}
                        disabled={isSaving}
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Remove funding source</span>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No funding sources added yet.
                </p>
              )}

              {/* Note: Backend API would need expansion to persist funding changes */}
            </div>
          </EditSection>

          {/* Conference Presentation */}
          <EditSection
            config={SECTIONS[8]}
            expanded={expandedSections.has('conference')}
            onToggle={() => toggleSection('conference')}
          >
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Conference where this work was presented.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="conferenceName">Conference Name</Label>
                  <ConferenceAutocomplete
                    id="conferenceName"
                    value={form.watch('conferencePresentation.conferenceName')}
                    placeholder="Search conferences (e.g., NeurIPS, ICML)..."
                    onSelect={handleConferenceSelect}
                    onClear={handleConferenceClear}
                    disabled={isSaving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="conferenceIteration">Conference Iteration</Label>
                  <Input
                    id="conferenceIteration"
                    placeholder="e.g., NeurIPS 2024"
                    {...form.register('conferencePresentation.conferenceIteration')}
                    disabled={isSaving}
                  />
                  <p className="text-xs text-muted-foreground">
                    Specific year or iteration of the conference
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="conferenceLocation">Location</Label>
                  <LocationAutocomplete
                    id="conferenceLocation"
                    value={form.watch('conferencePresentation.conferenceLocation')}
                    placeholder="Search locations (e.g., Vancouver, Canada)..."
                    onSelect={handleLocationSelect}
                    onClear={handleLocationClear}
                    disabled={isSaving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="presentationDate">Presentation Date</Label>
                  <Input
                    id="presentationDate"
                    type="date"
                    {...form.register('conferencePresentation.presentationDate')}
                    disabled={isSaving}
                  />
                  <p className="text-xs text-muted-foreground">Date when the work was presented</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="presentationType">Presentation Type</Label>
                  <NodeAutocomplete
                    id="presentationType"
                    kind="type"
                    subkind="presentation-type"
                    label="Presentation Type"
                    value={form.watch('conferencePresentation.presentationTypeUri')}
                    onSelect={handlePresentationTypeSelect}
                    onClear={handlePresentationTypeClear}
                    placeholder="Search presentation types..."
                    disabled={isSaving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="conferenceUrl">Conference URL</Label>
                  <Input
                    id="conferenceUrl"
                    type="url"
                    placeholder="https://..."
                    {...form.register('conferencePresentation.conferenceUrl')}
                    disabled={isSaving}
                  />
                </div>
              </div>

              {/* Note: Backend API would need expansion to persist conference changes */}
            </div>
          </EditSection>

          {/* Document */}
          <EditSection
            config={SECTIONS[9]}
            expanded={expandedSections.has('document')}
            onToggle={() => toggleSection('document')}
          >
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload a new document to replace the current one.
              </p>

              {selectedFile ? (
                <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-sm truncate">{selectedFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearFile}
                    disabled={isSaving}
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
                    onChange={handleFileChange}
                    disabled={isSaving}
                    accept=".pdf,.docx,.html,.md,.tex,.ipynb"
                    className="cursor-pointer"
                  />
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Supported: PDF, DOCX, HTML, Markdown, LaTeX, Jupyter Notebook
              </p>
            </div>
          </EditSection>

          {/* Version & Changelog */}
          <EditSection
            config={SECTIONS[10]}
            expanded={expandedSections.has('version')}
            onToggle={() => toggleSection('version')}
          >
            <div className="space-y-4">
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
                        disabled={isSaving}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <div>
                <Label className="mb-2 block">Changelog</Label>
                <ChangelogForm value={changelog} onChange={setChangelog} disabled={isSaving} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Document what changed in this version.
                </p>
              </div>
            </div>
          </EditSection>
        </div>

        {/* Bottom save button */}
        <div className="flex items-center justify-end gap-2 pt-6 border-t">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// =============================================================================
// EDIT SECTION COMPONENT
// =============================================================================

interface EditSectionProps {
  config: SectionConfig;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function EditSection({ config, expanded, onToggle, children }: EditSectionProps) {
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-muted-foreground">{config.icon}</div>
                <div>
                  <CardTitle className="text-base">{config.title}</CardTitle>
                  <CardDescription className="text-sm">{config.description}</CardDescription>
                </div>
              </div>
              <ChevronDown
                className={cn(
                  'h-5 w-5 text-muted-foreground transition-transform',
                  expanded && 'rotate-180'
                )}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
