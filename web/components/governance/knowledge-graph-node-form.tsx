'use client';

/**
 * Knowledge Graph Node form component.
 *
 * @remarks
 * Unified form for creating and editing nodes in the knowledge graph.
 * Supports all node kinds (type, object) and subkinds (field, facet,
 * institution, person, contribution-type, etc.).
 *
 * @packageDocumentation
 */

import { useState, useCallback, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Send,
  Loader2,
  Plus,
  X,
  Network,
  Layers,
  Building2,
  User,
  BookOpen,
  Tag,
  FileType,
  Scale,
  Award,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Node kind in the unified model.
 */
export type NodeKind = 'type' | 'object';

/**
 * Node status.
 */
export type NodeStatus = 'proposed' | 'provisional' | 'established' | 'deprecated';

/**
 * External identifier system.
 */
export type ExternalIdSystem =
  | 'wikidata'
  | 'ror'
  | 'orcid'
  | 'isni'
  | 'viaf'
  | 'lcsh'
  | 'fast'
  | 'credit'
  | 'spdx'
  | 'fundref'
  | 'gnd';

/**
 * External ID entry.
 */
export interface ExternalId {
  system: ExternalIdSystem;
  identifier: string;
  uri?: string;
}

/**
 * Form values for node creation.
 */
export interface KnowledgeGraphNodeFormValues {
  kind: NodeKind;
  subkind: string;
  label: string;
  alternateLabels: { value: string }[];
  description?: string;
  status: NodeStatus;
  externalIds: ExternalId[];
  metadata?: {
    country?: string;
    city?: string;
    website?: string;
    organizationStatus?: 'active' | 'merged' | 'inactive' | 'defunct';
    mimeTypes?: string[];
    spdxId?: string;
    displayOrder?: number;
  };
}

/**
 * Props for KnowledgeGraphNodeForm component.
 */
export interface KnowledgeGraphNodeFormProps {
  /** Existing node to edit (optional) */
  initialValues?: Partial<KnowledgeGraphNodeFormValues>;
  /** Form submission handler */
  onSubmit: (values: KnowledgeGraphNodeFormValues) => Promise<void>;
  /** Whether the user has trusted editor permissions */
  canEdit?: boolean;
  /** Restrict to specific kind */
  restrictKind?: NodeKind;
  /** Restrict to specific subkind */
  restrictSubkind?: string;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// SUBKIND CONFIGURATION
// =============================================================================

interface SubkindConfig {
  slug: string;
  kind: NodeKind;
  label: string;
  icon: typeof Network;
  description: string;
  relevantIdentifiers: ExternalIdSystem[];
  hasMetadata?: boolean;
}

const SUBKIND_CONFIGS: SubkindConfig[] = [
  // Type nodes
  {
    slug: 'field',
    kind: 'type',
    label: 'Academic Field',
    icon: Layers,
    description: 'Research discipline or subject area (hierarchy via edges)',
    relevantIdentifiers: ['wikidata', 'lcsh', 'fast'],
  },
  {
    slug: 'facet',
    kind: 'type',
    label: 'Classification Facet',
    icon: Tag,
    description: 'Classification dimension for organizing content',
    relevantIdentifiers: ['wikidata'],
  },
  {
    slug: 'contribution-type',
    kind: 'type',
    label: 'Contribution Type',
    icon: Award,
    description: 'CRediT contributor role (conceptualization, methodology, etc.)',
    relevantIdentifiers: ['credit', 'wikidata'],
  },
  {
    slug: 'document-format',
    kind: 'type',
    label: 'Document Format',
    icon: FileType,
    description: 'File or document format type (PDF, LaTeX, etc.)',
    relevantIdentifiers: ['wikidata'],
  },
  {
    slug: 'license',
    kind: 'type',
    label: 'License',
    icon: Scale,
    description: 'Distribution license (CC BY 4.0, MIT, etc.)',
    relevantIdentifiers: ['spdx', 'wikidata'],
  },
  {
    slug: 'publication-status',
    kind: 'type',
    label: 'Publication Status',
    icon: Clock,
    description: 'Publication lifecycle stage (preprint, published, etc.)',
    relevantIdentifiers: ['wikidata'],
  },
  {
    slug: 'institution-type',
    kind: 'type',
    label: 'Institution Type',
    icon: Building2,
    description: 'Organization classification (university, lab, etc.)',
    relevantIdentifiers: ['wikidata'],
  },
  {
    slug: 'paper-type',
    kind: 'type',
    label: 'Paper Type',
    icon: FileType,
    description: 'Research document type (original research, review, etc.)',
    relevantIdentifiers: ['wikidata'],
  },
  {
    slug: 'methodology',
    kind: 'type',
    label: 'Methodology',
    icon: BookOpen,
    description: 'Research methodology (qualitative, quantitative, etc.)',
    relevantIdentifiers: ['wikidata'],
  },
  // Object nodes
  {
    slug: 'institution',
    kind: 'object',
    label: 'Institution',
    icon: Building2,
    description: 'Research institution, university, or organization',
    relevantIdentifiers: ['ror', 'wikidata', 'isni', 'fundref'],
    hasMetadata: true,
  },
  {
    slug: 'person',
    kind: 'object',
    label: 'Person',
    icon: User,
    description: 'Named individual (researcher, editor, etc.)',
    relevantIdentifiers: ['orcid', 'wikidata', 'viaf', 'isni'],
  },
  {
    slug: 'event',
    kind: 'object',
    label: 'Event',
    icon: Clock,
    description: 'Conference, workshop, or named event',
    relevantIdentifiers: ['wikidata'],
  },
];

const SUBKIND_BY_SLUG = new Map(SUBKIND_CONFIGS.map((c) => [c.slug, c]));

// =============================================================================
// STATUS CONFIGURATION
// =============================================================================

const STATUS_CONFIG: Record<NodeStatus, { label: string; color: string; description: string }> = {
  proposed: {
    label: 'Proposed',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    description: 'Under review by community',
  },
  provisional: {
    label: 'Provisional',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    description: 'Accepted with limited use',
  },
  established: {
    label: 'Established',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    description: 'Fully approved for use',
  },
  deprecated: {
    label: 'Deprecated',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    description: 'No longer recommended',
  },
};

// =============================================================================
// EXTERNAL ID SYSTEMS
// =============================================================================

const EXTERNAL_ID_SYSTEMS: Record<
  ExternalIdSystem,
  { label: string; placeholder: string; url?: string }
> = {
  wikidata: { label: 'Wikidata', placeholder: 'Q12345', url: 'https://www.wikidata.org/wiki/' },
  ror: { label: 'ROR', placeholder: '0abcdef12', url: 'https://ror.org/' },
  orcid: { label: 'ORCID', placeholder: '0000-0002-1234-5678', url: 'https://orcid.org/' },
  isni: { label: 'ISNI', placeholder: '0000 0001 2345 6789' },
  viaf: { label: 'VIAF', placeholder: '12345678', url: 'https://viaf.org/viaf/' },
  lcsh: { label: 'LCSH', placeholder: 'sh85010001' },
  fast: { label: 'FAST', placeholder: 'fst00123456' },
  credit: {
    label: 'CRediT',
    placeholder: 'conceptualization',
    url: 'https://credit.niso.org/contributor-roles/',
  },
  spdx: { label: 'SPDX', placeholder: 'MIT', url: 'https://spdx.org/licenses/' },
  fundref: { label: 'FundRef', placeholder: '100000001' },
  gnd: { label: 'GND', placeholder: '118529579', url: 'https://d-nb.info/gnd/' },
};

// =============================================================================
// VALIDATION SCHEMA
// =============================================================================

const nodeFormSchema = z.object({
  kind: z.enum(['type', 'object']),
  subkind: z.string().min(1, 'Subkind is required'),
  label: z.string().min(1, 'Label is required').max(500, 'Label must be 500 characters or less'),
  alternateLabels: z
    .array(z.object({ value: z.string().max(500) }))
    .max(50)
    .default([]),
  description: z.string().max(2000, 'Description must be 2000 characters or less').optional(),
  status: z.enum(['proposed', 'provisional', 'established', 'deprecated']),
  externalIds: z
    .array(
      z.object({
        system: z.string(),
        identifier: z.string(),
        uri: z.string().optional(),
      })
    )
    .default([]),
  metadata: z
    .object({
      country: z.string().max(2).optional(),
      city: z.string().optional(),
      website: z.string().url().optional().or(z.literal('')),
      organizationStatus: z.enum(['active', 'merged', 'inactive', 'defunct']).optional(),
      mimeTypes: z.array(z.string()).optional(),
      spdxId: z.string().optional(),
      displayOrder: z.number().int().optional(),
    })
    .optional(),
});

type NodeFormSchema = z.infer<typeof nodeFormSchema>;

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Knowledge Graph Node creation/edit form.
 *
 * @example
 * ```tsx
 * <KnowledgeGraphNodeForm
 *   canEdit={isTrustedEditor}
 *   onSubmit={handleCreateNode}
 * />
 * ```
 */
export function KnowledgeGraphNodeForm({
  initialValues,
  onSubmit,
  canEdit = false,
  restrictKind,
  restrictSubkind,
  className,
}: KnowledgeGraphNodeFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isExternalIdsExpanded, setIsExternalIdsExpanded] = useState(false);
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);

  // Determine available subkinds based on restrictions
  const availableSubkinds = useMemo(() => {
    let configs = SUBKIND_CONFIGS;
    if (restrictKind) {
      configs = configs.filter((c) => c.kind === restrictKind);
    }
    if (restrictSubkind) {
      configs = configs.filter((c) => c.slug === restrictSubkind);
    }
    return configs;
  }, [restrictKind, restrictSubkind]);

  const form = useForm({
    resolver: zodResolver(nodeFormSchema) as ReturnType<typeof zodResolver<NodeFormSchema>>,
    defaultValues: {
      kind: initialValues?.kind ?? restrictKind ?? 'type',
      subkind: initialValues?.subkind ?? restrictSubkind ?? availableSubkinds[0]?.slug ?? 'field',
      label: initialValues?.label ?? '',
      alternateLabels: initialValues?.alternateLabels ?? [],
      description: initialValues?.description ?? '',
      status: initialValues?.status ?? 'proposed',
      externalIds: (initialValues?.externalIds ?? []).map((e) => ({
        system: e.system,
        identifier: e.identifier,
        uri: e.uri,
      })),
      metadata: initialValues?.metadata ?? {},
    },
  });

  const {
    fields: altLabelFields,
    append: appendAltLabel,
    remove: removeAltLabel,
  } = useFieldArray({
    control: form.control,
    name: 'alternateLabels',
  });

  const {
    fields: externalIdFields,
    append: appendExternalId,
    remove: removeExternalId,
  } = useFieldArray({
    control: form.control,
    name: 'externalIds',
  });

  const selectedSubkindSlug = form.watch('subkind');
  const selectedSubkind = SUBKIND_BY_SLUG.get(selectedSubkindSlug);

  // Update kind when subkind changes
  const handleSubkindChange = useCallback(
    (slug: string) => {
      form.setValue('subkind', slug);
      const config = SUBKIND_BY_SLUG.get(slug);
      if (config) {
        form.setValue('kind', config.kind);
      }
    },
    [form]
  );

  const handleSubmit = useCallback(
    async (values: NodeFormSchema) => {
      setIsSubmitting(true);
      setSubmitError(null);
      try {
        // Filter out empty alternate labels and external ids
        const cleanedValues: KnowledgeGraphNodeFormValues = {
          kind: values.kind,
          subkind: values.subkind,
          label: values.label,
          description: values.description,
          status: values.status,
          alternateLabels: values.alternateLabels.filter((l) => l.value.trim() !== ''),
          externalIds: values.externalIds
            .filter((e) => e.identifier.trim() !== '')
            .map((e) => ({
              system: e.system as ExternalIdSystem,
              identifier: e.identifier,
              uri: e.uri,
            })),
          metadata: values.metadata,
        };
        await onSubmit(cleanedValues);
        form.reset();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Failed to create node');
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSubmit, form]
  );

  if (!canEdit) {
    return (
      <Alert className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Permission Required</AlertTitle>
        <AlertDescription>
          Only trusted editors can create knowledge graph nodes. Check your governance status to see
          your progress toward trusted editor eligibility.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          Create Knowledge Graph Node
        </CardTitle>
        <CardDescription>
          Add a new node to the knowledge graph. Nodes can be types (classifications) or objects
          (instances). All nodes support external identifiers for interoperability.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {submitError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            {/* Subkind Selection */}
            {availableSubkinds.length > 1 && (
              <FormField
                control={form.control}
                name="subkind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Node Type</FormLabel>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {availableSubkinds.map((config) => {
                        const Icon = config.icon;
                        const isSelected = field.value === config.slug;
                        return (
                          <button
                            key={config.slug}
                            type="button"
                            onClick={() => handleSubkindChange(config.slug)}
                            className={cn(
                              'flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors',
                              isSelected
                                ? 'border-primary bg-primary/5 text-primary'
                                : 'border-border hover:border-primary/50 hover:bg-muted/50'
                            )}
                          >
                            <Icon className="h-5 w-5" />
                            <span className="text-sm font-medium">{config.label}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px]',
                                config.kind === 'type' ? 'text-blue-600' : 'text-green-600'
                              )}
                            >
                              {config.kind}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                    {selectedSubkind && (
                      <FormDescription>{selectedSubkind.description}</FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Separator />

            {/* Label */}
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter the canonical name or term" {...field} />
                  </FormControl>
                  <FormDescription>The primary, canonical form of this node.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Alternate Labels */}
            <div className="space-y-3">
              <Label>Alternate Labels</Label>
              <div className="space-y-2">
                {altLabelFields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <Input
                      {...form.register(`alternateLabels.${index}.value`)}
                      placeholder="Synonym, variant spelling, or translation"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAltLabel(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendAltLabel({ value: '' })}
                  disabled={altLabelFields.length >= 50}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Alternate Label
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Include synonyms, variant spellings, translations, and historical names.
              </p>
            </div>

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe this node and its scope"
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A clear description helps disambiguate similar terms and guides appropriate
                    usage.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(
                        Object.entries(STATUS_CONFIG) as [
                          NodeStatus,
                          typeof STATUS_CONFIG.proposed,
                        ][]
                      ).map(([status, config]) => (
                        <SelectItem key={status} value={status}>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={config.color}>
                              {config.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {config.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* External Identifiers */}
            <Collapsible open={isExternalIdsExpanded} onOpenChange={setIsExternalIdsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    <span>External Identifiers</span>
                    {selectedSubkind && (
                      <Badge variant="secondary" className="text-xs">
                        {selectedSubkind.relevantIdentifiers.length} suggested
                      </Badge>
                    )}
                  </div>
                  {isExternalIdsExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Link this node to established knowledge bases for interoperability.
                </p>

                {externalIdFields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-2">
                    <Select
                      value={form.watch(`externalIds.${index}.system`)}
                      onValueChange={(v) =>
                        form.setValue(`externalIds.${index}.system`, v as ExternalIdSystem)
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="System" />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          selectedSubkind?.relevantIdentifiers ?? Object.keys(EXTERNAL_ID_SYSTEMS)
                        ).map((system) => (
                          <SelectItem key={system} value={system}>
                            {EXTERNAL_ID_SYSTEMS[system as ExternalIdSystem]?.label ?? system}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      {...form.register(`externalIds.${index}.identifier`)}
                      placeholder={
                        EXTERNAL_ID_SYSTEMS[
                          form.watch(`externalIds.${index}.system`) as ExternalIdSystem
                        ]?.placeholder ?? 'Identifier'
                      }
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeExternalId(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    appendExternalId({
                      system:
                        selectedSubkind?.relevantIdentifiers[0] ?? ('wikidata' as ExternalIdSystem),
                      identifier: '',
                    })
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add External ID
                </Button>
              </CollapsibleContent>
            </Collapsible>

            {/* Metadata (for institution and similar) */}
            {selectedSubkind?.hasMetadata && (
              <Collapsible open={isMetadataExpanded} onOpenChange={setIsMetadataExpanded}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span>Additional Metadata</span>
                    </div>
                    {isMetadataExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="metadata.country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country Code</FormLabel>
                          <FormControl>
                            <Input placeholder="US" maxLength={2} {...field} />
                          </FormControl>
                          <FormDescription>ISO 3166-1 alpha-2</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="metadata.city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="Cambridge" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="metadata.website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.edu" type="url" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="metadata.organizationStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="merged">Merged</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="defunct">Defunct</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CollapsibleContent>
              </Collapsible>
            )}

            <Separator />

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Create Node
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
