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
  Github,
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
  ArxivAutocomplete,
  type ArxivEntry,
  PubmedAutocomplete,
  type PubmedEntry,
} from '@/components/forms';
import { useAuth } from '@/lib/auth/auth-context';
import { VersionSelector } from './version-selector';
import { ChangelogForm, type ChangelogFormData } from './changelog-form';
import { cn } from '@/lib/utils';
import { useAgent } from '@/lib/auth/auth-context';
import { authApi, createAuthenticatedClient } from '@/lib/api/client';
import type { Agent } from '@atproto/api';
import { parseAtUri } from '@/lib/utils/atproto';
import { createChangelogRecord } from '@/lib/atproto/record-creator';
import { logger } from '@/lib/observability';
import {
  formatVersion,
  useUpdateEprint,
  type VersionBumpType,
  type AuthorContribution,
} from '@/lib/hooks/use-eprint-mutations';
import { useContributionTypeNodes } from '@/lib/hooks/use-nodes';
import type { Eprint } from '@/lib/api/schema';

const editLogger = logger.child({ component: 'eprint-edit-sections' });

// =============================================================================
// TYPES
// =============================================================================

export interface EprintEditSectionsProps {
  /** The eprint to edit */
  eprint: Eprint;
  /** Paper agent for paper-centric eprints (from PaperAuthGate) */
  paperAgent?: Agent | null;
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
  grantTitle: z.string().optional(),
  grantUrl: z.string().url().optional().or(z.literal('')),
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

// Repository entry schema
const repositoryEntrySchema = z.object({
  url: z.union([z.string().url(), z.literal('')]).optional(),
  platformUri: z.string().optional(),
  platformName: z.string().optional(),
  label: z.string().optional(),
});

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
  ssrnId: z.string().optional(),
  osf: z.string().optional(),
  zenodoDoi: z.string().optional(),
  openAlexId: z.string().optional(),

  // Repositories
  codeRepositories: z.array(repositoryEntrySchema).optional(),
  dataRepositories: z.array(repositoryEntrySchema).optional(),
  preregistration: z
    .object({
      url: z.union([z.string().url(), z.literal('')]).optional(),
      platformUri: z.string().optional(),
      platformName: z.string().optional(),
    })
    .optional(),

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
    title: 'Repositories & Pre-registration',
    icon: <Github className="h-5 w-5" />,
    description: 'Code, data, and pre-registration links',
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
  paperAgent,
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
  const effectiveAgent = paperAgent ?? agent;
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
      ssrnId: eprint.externalIds?.ssrnId ?? '',
      osf: eprint.externalIds?.osf ?? '',
      zenodoDoi: eprint.externalIds?.zenodoDoi ?? '',
      openAlexId: eprint.externalIds?.openAlexId ?? '',
      codeRepositories: (eprint.repositories?.code ?? []).map((repo) => ({
        url: repo.url ?? '',
        platformUri: repo.platformUri ?? '',
        platformName: repo.platformSlug ?? '',
        label: repo.label ?? '',
      })),
      dataRepositories: (eprint.repositories?.data ?? []).map((repo) => ({
        url: repo.url ?? '',
        platformUri: repo.platformUri ?? '',
        platformName: repo.platformSlug ?? '',
        label: repo.label ?? '',
      })),
      preregistration: eprint.repositories?.preregistration
        ? {
            url: eprint.repositories.preregistration.url ?? '',
            platformUri: eprint.repositories.preregistration.platformUri ?? '',
            platformName: eprint.repositories.preregistration.platformSlug ?? '',
          }
        : { url: '', platformUri: '', platformName: '' },
      // Initialize funding from eprint
      funding:
        eprint.funding?.map((f) => ({
          funderName: f.funderName ?? '',
          funderUri: f.funderUri ?? '',
          funderDoi: f.funderDoi ?? '',
          funderRor: f.funderRor ?? '',
          grantNumber: f.grantNumber ?? '',
          grantTitle: f.grantTitle ?? '',
          grantUrl: f.grantUrl ?? '',
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

  // Repository field arrays
  const codeReposArray = useFieldArray({
    control: form.control,
    name: 'codeRepositories',
  });

  const dataReposArray = useFieldArray({
    control: form.control,
    name: 'dataRepositories',
  });

  // Add funding source
  const handleAddFunding = useCallback(() => {
    fundingArray.append({
      funderName: '',
      funderUri: '',
      funderDoi: '',
      funderRor: '',
      grantNumber: '',
      grantTitle: '',
      grantUrl: '',
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

  // Repository handlers
  const handleAddCodeRepo = useCallback(() => {
    codeReposArray.append({ url: '', platformUri: '', platformName: '', label: '' });
  }, [codeReposArray]);

  const handleAddDataRepo = useCallback(() => {
    dataReposArray.append({ url: '', platformUri: '', platformName: '', label: '' });
  }, [dataReposArray]);

  const handleCodePlatformSelect = useCallback(
    (node: NodeSuggestion, index: number) => {
      form.setValue(`codeRepositories.${index}.platformUri`, node.uri, { shouldValidate: true });
      form.setValue(`codeRepositories.${index}.platformName`, node.label, {
        shouldValidate: true,
      });
    },
    [form]
  );

  const handleCodePlatformClear = useCallback(
    (index: number) => {
      form.setValue(`codeRepositories.${index}.platformUri`, '', { shouldValidate: true });
      form.setValue(`codeRepositories.${index}.platformName`, '', { shouldValidate: true });
    },
    [form]
  );

  const handleDataPlatformSelect = useCallback(
    (node: NodeSuggestion, index: number) => {
      form.setValue(`dataRepositories.${index}.platformUri`, node.uri, { shouldValidate: true });
      form.setValue(`dataRepositories.${index}.platformName`, node.label, {
        shouldValidate: true,
      });
    },
    [form]
  );

  const handleDataPlatformClear = useCallback(
    (index: number) => {
      form.setValue(`dataRepositories.${index}.platformUri`, '', { shouldValidate: true });
      form.setValue(`dataRepositories.${index}.platformName`, '', { shouldValidate: true });
    },
    [form]
  );

  const handlePreregPlatformSelect = useCallback(
    (node: NodeSuggestion) => {
      form.setValue('preregistration.platformUri', node.uri, { shouldValidate: true });
      form.setValue('preregistration.platformName', node.label, { shouldValidate: true });
    },
    [form]
  );

  const handlePreregPlatformClear = useCallback(() => {
    form.setValue('preregistration.platformUri', '', { shouldValidate: true });
    form.setValue('preregistration.platformName', '', { shouldValidate: true });
  }, [form]);

  // External ID autocomplete handlers
  const handleArxivSelect = useCallback(
    (entry: ArxivEntry) => {
      form.setValue('arxivId', entry.id, { shouldValidate: true });
    },
    [form]
  );

  const handleArxivClear = useCallback(() => {
    form.setValue('arxivId', '', { shouldValidate: true });
  }, [form]);

  const handlePubmedSelect = useCallback(
    (entry: PubmedEntry) => {
      form.setValue('pmid', entry.pmid, { shouldValidate: true });
    },
    [form]
  );

  const handlePubmedClear = useCallback(() => {
    form.setValue('pmid', '', { shouldValidate: true });
  }, [form]);

  // Handle form submission
  const onSubmit = useCallback(
    async (data: EditFormValues) => {
      if (!effectiveAgent) {
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

        // External IDs (form values only; merged with PDS data in Step 4)
        if (
          data.arxivId ||
          data.pmid ||
          data.pmcid ||
          data.ssrnId ||
          data.osf ||
          data.zenodoDoi ||
          data.openAlexId
        ) {
          updates.externalIds = {
            ...(data.arxivId && { arxivId: data.arxivId }),
            ...(data.pmid && { pmid: data.pmid }),
            ...(data.pmcid && { pmcid: data.pmcid }),
            ...(data.ssrnId && { ssrnId: data.ssrnId }),
            ...(data.osf && { osf: data.osf }),
            ...(data.zenodoDoi && { zenodoDoi: data.zenodoDoi }),
            ...(data.openAlexId && { openAlexId: data.openAlexId }),
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

        // Build repositories from multi-entry arrays
        const codeRepos = (data.codeRepositories ?? [])
          .filter((r) => r.url)
          .map((r) => ({
            url: r.url,
            ...(r.platformUri && { platformUri: r.platformUri }),
            ...(r.platformName && { platformSlug: r.platformName }),
            ...(r.label && { label: r.label }),
          }));

        const dataRepos = (data.dataRepositories ?? [])
          .filter((r) => r.url)
          .map((r) => ({
            url: r.url,
            ...(r.platformUri && { platformUri: r.platformUri }),
            ...(r.platformName && { platformSlug: r.platformName }),
            ...(r.label && { label: r.label }),
          }));

        const preregData = data.preregistration?.url
          ? {
              url: data.preregistration.url,
              ...(data.preregistration.platformUri && {
                platformUri: data.preregistration.platformUri,
              }),
              ...(data.preregistration.platformName && {
                platformSlug: data.preregistration.platformName,
              }),
            }
          : undefined;

        const hasRepositories = codeRepos.length > 0 || dataRepos.length > 0 || preregData;
        const repositoriesPayload = hasRepositories
          ? {
              ...(codeRepos.length > 0 && { code: codeRepos }),
              ...(dataRepos.length > 0 && { data: dataRepos }),
              ...(preregData && { preregistration: preregData }),
            }
          : undefined;

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

        // Build conference presentation payload if any fields are filled
        const confData = data.conferencePresentation;
        const hasConference = confData?.conferenceName || confData?.conferenceUri;
        const conferencePresentationPayload = hasConference
          ? {
              ...(confData?.conferenceName && { conferenceName: confData.conferenceName }),
              ...(confData?.conferenceUri && { conferenceUri: confData.conferenceUri }),
              ...(confData?.conferenceUrl && { conferenceUrl: confData.conferenceUrl }),
              ...(confData?.conferenceLocation && {
                conferenceLocation: confData.conferenceLocation,
              }),
              ...(confData?.presentationDate && { presentationDate: confData.presentationDate }),
              ...(confData?.presentationTypeUri && {
                presentationTypeUri: confData.presentationTypeUri,
              }),
            }
          : undefined;

        // Build funding payload
        const fundingPayload = data.funding?.length
          ? data.funding
              .filter((f) => f.funderName.trim())
              .map((f) => ({
                funderName: f.funderName,
                ...(f.funderUri && { funderUri: f.funderUri }),
                ...(f.funderDoi && { funderDoi: f.funderDoi }),
                ...(f.funderRor && { funderRor: f.funderRor }),
                ...(f.grantNumber && { grantNumber: f.grantNumber }),
                ...(f.grantTitle && { grantTitle: f.grantTitle }),
                ...(f.grantUrl && { grantUrl: f.grantUrl }),
              }))
          : undefined;

        // Step 1: Call backend authorization endpoint with all metadata
        const authResult = await updateEprint({
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
          publishedVersion: updates.publishedVersion as Record<string, unknown> | undefined,
          externalIds: updates.externalIds as Record<string, unknown> | undefined,
          repositories: repositoriesPayload as Record<string, unknown> | undefined,
          conferencePresentation: conferencePresentationPayload as
            | Record<string, unknown>
            | undefined,
          funding: fundingPayload as Record<string, unknown>[] | undefined,
          overrideAgent: paperAgent ?? undefined,
        });

        editLogger.info('Authorization successful', {
          uri: eprint.uri,
          newVersion: formatVersion(authResult.version),
        });

        // Step 2: Upload new document if provided
        let documentBlobRef = undefined;
        if (selectedFile) {
          const fileBytes = new Uint8Array(await selectedFile.arrayBuffer());
          const uploadResult = await effectiveAgent.uploadBlob(fileBytes, {
            encoding: selectedFile.type || 'application/pdf',
          });
          documentBlobRef = uploadResult.data.blob;
          editLogger.info('Document uploaded', { cid: documentBlobRef.ref.toString() });
        }

        // Step 3: Fetch current record from PDS to merge with updates
        const parsed = parseAtUri(eprint.uri);
        if (!parsed) {
          throw new Error('Invalid AT-URI: ' + eprint.uri);
        }

        const currentRecord = await effectiveAgent.com.atproto.repo.getRecord({
          repo: parsed.did,
          collection: parsed.collection,
          rkey: parsed.rkey,
        });

        // Step 4: Build updated record, merging form data with existing PDS data
        // to preserve sub-fields that the form does not expose.
        const currentRecordValue = currentRecord.data.value as Record<string, unknown>;

        // Merge externalIds: preserve sub-fields not in form
        const mergedExternalIds = updates.externalIds
          ? {
              ...((currentRecordValue.externalIds as Record<string, unknown>) ?? {}),
              ...(data.arxivId !== undefined && { arxivId: data.arxivId || undefined }),
              ...(data.pmid !== undefined && { pmid: data.pmid || undefined }),
              ...(data.pmcid !== undefined && { pmcid: data.pmcid || undefined }),
              ...(data.ssrnId !== undefined && { ssrnId: data.ssrnId || undefined }),
              ...(data.osf !== undefined && { osf: data.osf || undefined }),
              ...(data.zenodoDoi !== undefined && { zenodoDoi: data.zenodoDoi || undefined }),
              ...(data.openAlexId !== undefined && { openAlexId: data.openAlexId || undefined }),
            }
          : undefined;

        // Merge publishedVersion: preserve sub-fields not in form (publishedAt, publisher, etc.)
        const mergedPublishedVersion = updates.publishedVersion
          ? {
              ...((currentRecordValue.publishedVersion as Record<string, unknown>) ?? {}),
              ...(data.publishedDoi !== undefined && { doi: data.publishedDoi || undefined }),
              ...(data.publishedUrl !== undefined && { url: data.publishedUrl || undefined }),
              ...(data.publishedJournal !== undefined && {
                journal: data.publishedJournal || undefined,
              }),
              ...(data.publishedVolume !== undefined && {
                volume: data.publishedVolume || undefined,
              }),
              ...(data.publishedIssue !== undefined && {
                issue: data.publishedIssue || undefined,
              }),
              ...(data.publishedPages !== undefined && {
                pages: data.publishedPages || undefined,
              }),
            }
          : undefined;

        // Merge repositories with PDS data to preserve sub-fields
        const existingRepos = (currentRecordValue.repositories as Record<string, unknown>) ?? {};
        const mergedRepositories: Record<string, unknown> = { ...existingRepos };

        if (codeRepos.length > 0) {
          const existingCode = Array.isArray(existingRepos.code) ? existingRepos.code : [];
          mergedRepositories.code = codeRepos.map((repo, i) => ({
            ...((existingCode[i] as Record<string, unknown>) ?? {}),
            ...repo,
          }));
        } else if (data.codeRepositories !== undefined && data.codeRepositories.length === 0) {
          delete mergedRepositories.code;
        }

        if (dataRepos.length > 0) {
          const existingData = Array.isArray(existingRepos.data) ? existingRepos.data : [];
          mergedRepositories.data = dataRepos.map((repo, i) => ({
            ...((existingData[i] as Record<string, unknown>) ?? {}),
            ...repo,
          }));
        } else if (data.dataRepositories !== undefined && data.dataRepositories.length === 0) {
          delete mergedRepositories.data;
        }

        if (preregData) {
          mergedRepositories.preregistration = {
            ...((existingRepos.preregistration as Record<string, unknown>) ?? {}),
            ...preregData,
          };
        }

        const mergedHasRepositories = Object.keys(mergedRepositories).some(
          (k) => k !== '$type' && mergedRepositories[k] !== undefined
        );
        const mergedRepositoriesPayload = mergedHasRepositories ? mergedRepositories : undefined;

        // Merge conferencePresentation: preserve sub-fields not in form
        // (conferenceAcronym, conferenceIteration, presentationTypeSlug, proceedingsDoi)
        const existingConf =
          (currentRecordValue.conferencePresentation as Record<string, unknown>) ?? {};
        const mergedConferencePresentation = hasConference
          ? {
              ...existingConf,
              ...(confData?.conferenceName && { conferenceName: confData.conferenceName }),
              ...(confData?.conferenceUri && { conferenceUri: confData.conferenceUri }),
              ...(confData?.conferenceUrl && { conferenceUrl: confData.conferenceUrl }),
              ...(confData?.conferenceLocation && {
                conferenceLocation: confData.conferenceLocation,
              }),
              ...(confData?.presentationDate && { presentationDate: confData.presentationDate }),
              ...(confData?.presentationTypeUri && {
                presentationTypeUri: confData.presentationTypeUri,
              }),
            }
          : undefined;

        // Merge funding: preserve any sub-fields not in form from existing PDS data
        const existingFunding = Array.isArray(currentRecordValue.funding)
          ? (currentRecordValue.funding as Record<string, unknown>[])
          : [];
        const mergedFunding = data.funding?.length
          ? data.funding
              .filter((f) => f.funderName.trim())
              .map((f, i) => ({
                ...(existingFunding[i] ?? {}),
                funderName: f.funderName,
                ...(f.funderUri && { funderUri: f.funderUri }),
                ...(f.funderDoi && { funderDoi: f.funderDoi }),
                ...(f.funderRor && { funderRor: f.funderRor }),
                ...(f.grantNumber && { grantNumber: f.grantNumber }),
                ...(f.grantTitle && { grantTitle: f.grantTitle }),
                ...(f.grantUrl && { grantUrl: f.grantUrl }),
              }))
          : undefined;

        const updatedRecord = {
          ...currentRecordValue,
          title: data.title,
          ...(data.abstract && data.abstract !== eprint.abstract && { abstract: data.abstract }),
          keywords: keywords ?? currentRecordValue.keywords,
          version: authResult.version,
          ...(fieldUris && { fieldNodes: fieldUris.map((uri) => ({ uri })) }),
          ...(authorsPayload.length > 0 && { authors: authorsPayload }),
          ...(documentBlobRef && { document: documentBlobRef }),
          ...(mergedPublishedVersion ? { publishedVersion: mergedPublishedVersion } : {}),
          ...(mergedExternalIds ? { externalIds: mergedExternalIds } : {}),
          ...(mergedRepositoriesPayload ? { repositories: mergedRepositoriesPayload } : {}),
          ...(mergedConferencePresentation
            ? { conferencePresentation: mergedConferencePresentation }
            : {}),
          ...(mergedFunding ? { funding: mergedFunding } : {}),
        };

        // Step 5: Make PDS putRecord call with optimistic concurrency control
        await effectiveAgent.com.atproto.repo.putRecord({
          repo: parsed.did,
          collection: parsed.collection,
          rkey: parsed.rkey,
          record: updatedRecord,
          swapRecord: authResult.expectedCid,
        });

        // Build an API client that uses the paper agent for indexing when available
        const apiClient = paperAgent ? createAuthenticatedClient(effectiveAgent) : authApi;

        // Step 5.5: Create changelog record in PDS (if changelog provided)
        const hasChangelog = changelog.summary || changelog.sections.length > 0;
        if (hasChangelog) {
          try {
            const changelogResult = await createChangelogRecord(effectiveAgent, {
              eprintUri: eprint.uri,
              version: authResult.version,
              previousVersion: eprint.version || undefined,
              summary: changelog.summary || undefined,
              sections: changelog.sections
                .map((section) => ({
                  category: section.category,
                  items: section.items
                    .filter((item) => item.description.trim())
                    .map((item) => ({
                      description: item.description,
                      changeType: item.changeType || undefined,
                      location: item.location || undefined,
                      reviewReference: item.reviewReference || undefined,
                    })),
                }))
                .filter((section) => section.items.length > 0),
              reviewerResponse: changelog.reviewerResponse || undefined,
            });
            editLogger.info('Changelog record created', { uri: changelogResult.uri });

            // Request immediate indexing for the changelog record (best-effort)
            try {
              await apiClient.pub.chive.sync.indexRecord({ uri: changelogResult.uri });
            } catch {
              editLogger.warn('Immediate changelog indexing failed; firehose will handle', {
                uri: changelogResult.uri,
              });
            }
          } catch (changelogError) {
            editLogger.warn('Failed to create changelog record', {
              uri: eprint.uri,
              error:
                changelogError instanceof Error ? changelogError.message : String(changelogError),
            });
            // Non-critical: do not fail the whole update
          }
        }

        // Step 6: Request immediate re-indexing (best-effort)
        try {
          await apiClient.pub.chive.sync.indexRecord({ uri: eprint.uri });
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch {
          editLogger.warn('Immediate re-indexing failed; firehose will handle', {
            uri: eprint.uri,
          });
        }

        toast.success('Eprint updated successfully', {
          description: `Version ${formatVersion(authResult.version)}`,
        });

        onSaveSuccess?.();
      } catch (error) {
        editLogger.error('Failed to update eprint', error);

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
        setIsSaving(false);
      }
    },
    [
      effectiveAgent,
      paperAgent,
      eprint,
      changelog,
      updateEprint,
      onSaveSuccess,
      setIsSaving,
      authors,
      selectedFile,
    ]
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
                      <ArxivAutocomplete
                        value={field.value}
                        onSelect={handleArxivSelect}
                        onChange={field.onChange}
                        onClear={handleArxivClear}
                        placeholder="Search by title or arXiv ID..."
                        disabled={isSaving}
                      />
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
                      <PubmedAutocomplete
                        value={field.value}
                        onSelect={handlePubmedSelect}
                        onChange={field.onChange}
                        onClear={handlePubmedClear}
                        placeholder="Search by title or PMID..."
                        disabled={isSaving}
                      />
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

              <FormField
                control={form.control}
                name="ssrnId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SSRN ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="1234567" disabled={isSaving} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="osf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OSF ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="abc12" disabled={isSaving} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="zenodoDoi"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zenodo DOI</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="10.5281/zenodo.1234567" disabled={isSaving} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="openAlexId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OpenAlex ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="W1234567890" disabled={isSaving} />
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
            <div className="space-y-6">
              {/* Code Repositories */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Code Repositories</Label>
                    <p className="text-sm text-muted-foreground">
                      Link to code repositories for reproducibility.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddCodeRepo}
                    disabled={isSaving}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Repository
                  </Button>
                </div>
                {codeReposArray.fields.map((field, index) => (
                  <div key={field.id} className="flex gap-3 items-start p-4 border rounded-lg">
                    <div className="flex-1 grid gap-3 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label>URL</Label>
                        <Input
                          type="url"
                          placeholder="https://github.com/..."
                          {...form.register(`codeRepositories.${index}.url`)}
                          disabled={isSaving}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Platform</Label>
                        <NodeAutocomplete
                          kind="object"
                          subkind="platform-code"
                          label="Code Platform"
                          value={form.watch(`codeRepositories.${index}.platformUri`)}
                          onSelect={(node) => handleCodePlatformSelect(node, index)}
                          onClear={() => handleCodePlatformClear(index)}
                          placeholder="Search platforms..."
                          disabled={isSaving}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Label</Label>
                        <Input
                          placeholder="Analysis code"
                          {...form.register(`codeRepositories.${index}.label`)}
                          disabled={isSaving}
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => codeReposArray.remove(index)}
                      disabled={isSaving}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Data Repositories */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Data Repositories</Label>
                    <p className="text-sm text-muted-foreground">
                      Link to data repositories for reproducibility.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddDataRepo}
                    disabled={isSaving}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Repository
                  </Button>
                </div>
                {dataReposArray.fields.map((field, index) => (
                  <div key={field.id} className="flex gap-3 items-start p-4 border rounded-lg">
                    <div className="flex-1 grid gap-3 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label>URL</Label>
                        <Input
                          type="url"
                          placeholder="https://zenodo.org/..."
                          {...form.register(`dataRepositories.${index}.url`)}
                          disabled={isSaving}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Platform</Label>
                        <NodeAutocomplete
                          kind="object"
                          subkind="platform-data"
                          label="Data Platform"
                          value={form.watch(`dataRepositories.${index}.platformUri`)}
                          onSelect={(node) => handleDataPlatformSelect(node, index)}
                          onClear={() => handleDataPlatformClear(index)}
                          placeholder="Search platforms..."
                          disabled={isSaving}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Label</Label>
                        <Input
                          placeholder="Experiment data"
                          {...form.register(`dataRepositories.${index}.label`)}
                          disabled={isSaving}
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => dataReposArray.remove(index)}
                      disabled={isSaving}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Pre-registration */}
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-medium">Pre-registration</Label>
                  <p className="text-sm text-muted-foreground">
                    Link to pre-registration or registered report.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>URL</Label>
                    <Input
                      type="url"
                      placeholder="https://osf.io/..."
                      {...form.register('preregistration.url')}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Platform</Label>
                    <NodeAutocomplete
                      kind="object"
                      subkind="platform-preregistration"
                      label="Preregistration Platform"
                      value={form.watch('preregistration.platformUri')}
                      onSelect={handlePreregPlatformSelect}
                      onClear={handlePreregPlatformClear}
                      placeholder="Search preregistration platforms..."
                      disabled={isSaving}
                    />
                  </div>
                </div>
              </div>
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
                        <div className="space-y-2">
                          <Label htmlFor={`funding-title-${index}`}>Grant Title</Label>
                          <Input
                            id={`funding-title-${index}`}
                            placeholder="Grant title (optional)"
                            {...form.register(`funding.${index}.grantTitle`)}
                            disabled={isSaving}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`funding-url-${index}`}>Grant URL</Label>
                          <Input
                            id={`funding-url-${index}`}
                            placeholder="https://..."
                            {...form.register(`funding.${index}.grantUrl`)}
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
