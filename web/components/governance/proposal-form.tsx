'use client';

/**
 * Unified governance proposal form component.
 *
 * @remarks
 * Form for creating governance proposals. Supports:
 * - Knowledge graph field proposals (create, update, merge, delete)
 * - Contribution type proposals (create, update, deprecate)
 *
 * @packageDocumentation
 */

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Send,
  Loader2,
  Info,
  Plus,
  Merge,
  Edit,
  Trash2,
  FileText,
  Users,
  ExternalLink,
  Layers,
  Building2,
  Link2,
  Globe,
  Tag,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { FieldSearch, type FieldSelection } from '@/components/forms';
import { cn } from '@/lib/utils';
import { useAuth, useAgent } from '@/lib/auth/auth-context';
import { useCreateProposal, CATEGORY_LABELS } from '@/lib/hooks/use-governance';
import {
  useContributionTypes,
  type CreditContributionType,
} from '@/lib/hooks/use-contribution-types';
import { createFieldProposalRecord } from '@/lib/atproto';
import type {
  ProposalType,
  ProposalCategory,
  Proposal,
  FacetDimension,
  OrganizationType,
  ReconciliationSystem,
  ReconciliationMatchType,
  ReconcilableEntityType,
} from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Form values for proposal creation.
 *
 * @remarks
 * Exported for external use. Internal form uses `FormValuesInferred` which is
 * derived directly from the Zod schema for type safety.
 */
export type ProposalFormValues = {
  /** Proposal category */
  category: ProposalCategory;
  /** Proposal type (action) */
  type: ProposalType;

  // Field-specific fields
  /** Target field for update/merge/delete */
  targetField?: FieldSelection;
  /** Merge target field */
  mergeTargetField?: FieldSelection;
  /** Proposed field name */
  fieldName: string;
  /** Proposed field description */
  description: string;
  /** Field type category */
  fieldType: 'field' | 'root' | 'subfield' | 'topic';
  /** Parent field for new fields */
  parentField?: FieldSelection;
  /** Wikidata ID */
  wikidataId?: string;

  // Contribution type-specific fields
  /** Existing contribution type (for update/deprecate) */
  existingTypeId?: string;
  /** Proposed type ID */
  proposedId: string;
  /** Proposed type label */
  proposedLabel: string;
  /** CRediT URI */
  creditUri?: string;
  /** CRO URI */
  croUri?: string;

  // Facet-specific fields
  /** Facet dimension (PMEST or FAST) */
  facetDimension?: FacetDimension;
  /** Existing facet ID (for update/delete) */
  existingFacetId?: string;
  /** Facet value ID */
  facetValueId: string;
  /** Facet value label */
  facetValueLabel: string;
  /** Parent facet value ID */
  parentFacetId?: string;
  /** LCSH URI for facet */
  lcshUri?: string;
  /** FAST URI for facet */
  fastUri?: string;

  // Organization-specific fields
  /** Existing organization ID (for update/delete) */
  existingOrgId?: string;
  /** Organization name */
  orgName: string;
  /** Organization type */
  orgType?: OrganizationType;
  /** ROR ID */
  rorId?: string;
  /** Country code */
  country?: string;
  /** City */
  city?: string;
  /** Website URL */
  website?: string;
  /** Organization aliases */
  aliases: string;
  /** Parent organization ID */
  parentOrgId?: string;

  // Reconciliation-specific fields
  /** Existing reconciliation ID (for update/delete) */
  existingReconciliationId?: string;
  /** Source entity type */
  sourceEntityType?: ReconcilableEntityType;
  /** Source entity URI */
  sourceEntityUri?: string;
  /** Source entity label (for display) */
  sourceEntityLabel?: string;
  /** Target external system */
  targetSystem?: ReconciliationSystem;
  /** Target identifier in external system */
  targetId: string;
  /** Target URI in external system */
  targetUri: string;
  /** Target label in external system */
  targetLabel: string;
  /** Match type (SKOS relation) */
  matchType?: ReconciliationMatchType;
  /** Confidence score (0-1) */
  confidence?: number;

  // Common fields
  /** Rationale for the proposal */
  rationale: string;
};

/**
 * Props for ProposalForm component.
 */
export interface ProposalFormProps {
  /** Callback when proposal is created successfully */
  onSuccess?: (proposal: Proposal) => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Pre-selected category */
  defaultCategory?: ProposalCategory;
  /** Pre-selected proposal type */
  defaultType?: ProposalType;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CATEGORIES = [
  {
    value: 'field' as const,
    label: 'Knowledge Graph Field',
    description: 'Propose changes to research fields and disciplines',
    icon: FileText,
  },
  {
    value: 'contribution-type' as const,
    label: 'Contribution Type',
    description: 'Propose changes to CRediT contribution types',
    icon: Users,
  },
  {
    value: 'facet' as const,
    label: 'Facet Value',
    description: 'Propose PMEST/FAST classification facet values',
    icon: Layers,
  },
  {
    value: 'organization' as const,
    label: 'Organization',
    description: 'Propose research institutions and organizations',
    icon: Building2,
  },
  {
    value: 'reconciliation' as const,
    label: 'Reconciliation',
    description: 'Link Chive entities to external knowledge bases',
    icon: Link2,
  },
];

const FIELD_PROPOSAL_TYPES = [
  {
    value: 'create' as const,
    label: 'Create Field',
    description: 'Propose a new knowledge graph field',
    icon: Plus,
  },
  {
    value: 'update' as const,
    label: 'Update Field',
    description: 'Modify an existing field',
    icon: Edit,
  },
  {
    value: 'merge' as const,
    label: 'Merge Fields',
    description: 'Combine two fields into one',
    icon: Merge,
  },
  {
    value: 'delete' as const,
    label: 'Delete Field',
    description: 'Request removal of a field',
    icon: Trash2,
  },
];

const CONTRIBUTION_PROPOSAL_TYPES = [
  {
    value: 'create' as const,
    label: 'Create Type',
    description: 'Propose a new contribution type',
    icon: Plus,
  },
  {
    value: 'update' as const,
    label: 'Update Type',
    description: 'Modify an existing type',
    icon: Edit,
  },
  {
    value: 'delete' as const,
    label: 'Deprecate Type',
    description: 'Mark a type as deprecated',
    icon: Trash2,
  },
];

const FIELD_TYPES = [
  { value: 'root', label: 'Root Field', description: 'Top-level discipline' },
  { value: 'field', label: 'Field', description: 'Major subject area' },
  { value: 'subfield', label: 'Subfield', description: 'Specialized area within a field' },
  { value: 'topic', label: 'Topic', description: 'Specific research topic' },
];

const FACET_PROPOSAL_TYPES = [
  {
    value: 'create' as const,
    label: 'Create Facet Value',
    description: 'Propose a new facet value',
    icon: Plus,
  },
  {
    value: 'update' as const,
    label: 'Update Facet Value',
    description: 'Modify an existing facet value',
    icon: Edit,
  },
  {
    value: 'delete' as const,
    label: 'Deprecate Facet Value',
    description: 'Mark a facet value as deprecated',
    icon: Trash2,
  },
];

const ORGANIZATION_PROPOSAL_TYPES = [
  {
    value: 'create' as const,
    label: 'Create Organization',
    description: 'Propose a new organization',
    icon: Plus,
  },
  {
    value: 'update' as const,
    label: 'Update Organization',
    description: 'Modify organization details',
    icon: Edit,
  },
  {
    value: 'merge' as const,
    label: 'Merge Organizations',
    description: 'Combine duplicate organizations',
    icon: Merge,
  },
  {
    value: 'delete' as const,
    label: 'Deprecate Organization',
    description: 'Mark as deprecated',
    icon: Trash2,
  },
];

const RECONCILIATION_PROPOSAL_TYPES = [
  {
    value: 'create' as const,
    label: 'Create Reconciliation',
    description: 'Link to external knowledge base',
    icon: Plus,
  },
  {
    value: 'update' as const,
    label: 'Update Reconciliation',
    description: 'Modify link details',
    icon: Edit,
  },
  {
    value: 'delete' as const,
    label: 'Remove Reconciliation',
    description: 'Remove incorrect link',
    icon: Trash2,
  },
];

/** PMEST facet dimensions (Ranganathan's Colon Classification) */
const PMEST_DIMENSIONS = [
  {
    value: 'personality',
    label: 'Personality',
    description: 'What the subject is about (entities)',
  },
  { value: 'matter', label: 'Matter', description: 'Materials, properties, or constituents' },
  { value: 'energy', label: 'Energy', description: 'Processes, methods, or operations' },
  { value: 'space', label: 'Space', description: 'Geographic or institutional location' },
  { value: 'time', label: 'Time', description: 'Temporal aspects or periods' },
];

/** FAST entity facets (Library of Congress FAST schema) */
const FAST_DIMENSIONS = [
  { value: 'person', label: 'Person', description: 'Named individuals' },
  { value: 'organization', label: 'Organization', description: 'Corporations, institutions' },
  { value: 'event', label: 'Event', description: 'Named events, conferences' },
  { value: 'work', label: 'Work', description: 'Named works (books, films, etc.)' },
  { value: 'form-genre', label: 'Form/Genre', description: 'Document types and formats' },
];

/** All facet dimensions combined */
const FACET_DIMENSIONS = [...PMEST_DIMENSIONS, ...FAST_DIMENSIONS];

/** Organization types */
const ORGANIZATION_TYPES = [
  { value: 'university', label: 'University' },
  { value: 'research-lab', label: 'Research Lab' },
  { value: 'funding-body', label: 'Funding Body' },
  { value: 'publisher', label: 'Publisher' },
  { value: 'consortium', label: 'Consortium' },
  { value: 'hospital', label: 'Hospital/Medical Center' },
  { value: 'government', label: 'Government Agency' },
  { value: 'nonprofit', label: 'Nonprofit Organization' },
  { value: 'company', label: 'Company/Corporation' },
  { value: 'other', label: 'Other' },
];

/** External reconciliation systems */
const RECONCILIATION_SYSTEMS = [
  { value: 'wikidata', label: 'Wikidata', description: 'Wikimedia knowledge base' },
  { value: 'ror', label: 'ROR', description: 'Research Organization Registry' },
  { value: 'orcid', label: 'ORCID', description: 'Researcher identifiers' },
  { value: 'openalex', label: 'OpenAlex', description: 'Open scholarly metadata' },
  { value: 'crossref', label: 'Crossref', description: 'DOI registration agency' },
  { value: 'arxiv', label: 'arXiv', description: 'Eprint repository' },
  { value: 'semantic-scholar', label: 'Semantic Scholar', description: 'AI-powered research tool' },
  { value: 'pubmed', label: 'PubMed', description: 'Biomedical literature' },
  { value: 'credit', label: 'CRediT', description: 'Contributor role taxonomy' },
  { value: 'cro', label: 'CRO', description: 'Contributor Role Ontology' },
  { value: 'lcsh', label: 'LCSH', description: 'Library of Congress Subject Headings' },
  { value: 'fast', label: 'FAST', description: 'Faceted Application of Subject Terminology' },
  { value: 'other', label: 'Other', description: 'Other external system' },
];

/** Reconciliation match types (SKOS mapping relations) */
const MATCH_TYPES = [
  { value: 'exact-match', label: 'Exact Match', description: 'Equivalent concepts' },
  {
    value: 'close-match',
    label: 'Close Match',
    description: 'Very similar, interchangeable in some contexts',
  },
  { value: 'broader-match', label: 'Broader Match', description: 'Target is broader than source' },
  {
    value: 'narrower-match',
    label: 'Narrower Match',
    description: 'Target is narrower than source',
  },
  { value: 'related-match', label: 'Related Match', description: 'Associated but not equivalent' },
];

/** Entity types that can be reconciled */
const RECONCILABLE_ENTITY_TYPES = [
  { value: 'field', label: 'Knowledge Graph Field' },
  { value: 'contribution-type', label: 'Contribution Type' },
  { value: 'facet', label: 'Facet Value' },
  { value: 'organization', label: 'Organization' },
  { value: 'author', label: 'Author' },
  { value: 'eprint', label: 'Eprint' },
];

// =============================================================================
// VALIDATION SCHEMA
// =============================================================================

const baseFormSchema = z.object({
  category: z.enum(['field', 'contribution-type', 'facet', 'organization', 'reconciliation']),
  type: z.enum(['create', 'update', 'merge', 'delete']),

  // Field-specific
  targetField: z.object({ id: z.string(), name: z.string() }).optional(),
  mergeTargetField: z.object({ id: z.string(), name: z.string() }).optional(),
  fieldName: z.string().max(200).default(''),
  description: z.string().max(5000).default(''),
  fieldType: z.enum(['field', 'root', 'subfield', 'topic']).default('topic'),
  parentField: z.object({ id: z.string(), name: z.string() }).optional(),
  wikidataId: z.string().default(''),

  // Contribution type-specific
  existingTypeId: z.string().optional(),
  proposedId: z.string().max(50).default(''),
  proposedLabel: z.string().max(100).default(''),
  creditUri: z.string().default(''),
  croUri: z.string().default(''),

  // Facet-specific
  facetDimension: z
    .enum([
      'personality',
      'matter',
      'energy',
      'space',
      'time',
      'person',
      'organization',
      'event',
      'work',
      'form-genre',
    ])
    .optional(),
  existingFacetId: z.string().optional(),
  facetValueId: z.string().max(50).default(''),
  facetValueLabel: z.string().max(200).default(''),
  parentFacetId: z.string().optional(),
  lcshUri: z.string().default(''),
  fastUri: z.string().default(''),

  // Organization-specific
  existingOrgId: z.string().optional(),
  orgName: z.string().max(300).default(''),
  orgType: z
    .enum([
      'university',
      'research-lab',
      'funding-body',
      'publisher',
      'consortium',
      'hospital',
      'government',
      'nonprofit',
      'company',
      'other',
    ])
    .optional(),
  rorId: z.string().default(''),
  country: z.string().max(2).default(''),
  city: z.string().max(100).default(''),
  website: z.string().default(''),
  aliases: z.string().default(''),
  parentOrgId: z.string().optional(),

  // Reconciliation-specific
  existingReconciliationId: z.string().optional(),
  sourceEntityType: z
    .enum(['field', 'contribution-type', 'facet', 'organization', 'author', 'eprint'])
    .optional(),
  sourceEntityUri: z.string().default(''),
  sourceEntityLabel: z.string().default(''),
  targetSystem: z
    .enum([
      'wikidata',
      'ror',
      'orcid',
      'openalex',
      'crossref',
      'arxiv',
      'semantic-scholar',
      'pubmed',
      'credit',
      'cro',
      'lcsh',
      'fast',
      'other',
    ])
    .optional(),
  targetId: z.string().max(200).default(''),
  targetUri: z.string().default(''),
  targetLabel: z.string().max(500).default(''),
  matchType: z
    .enum(['exact-match', 'close-match', 'broader-match', 'narrower-match', 'related-match'])
    .optional(),
  confidence: z.number().min(0).max(1).optional(),

  // Common
  rationale: z.string().min(20, 'Rationale must be at least 20 characters').max(2000),
});

/**
 * Inferred form values type from schema.
 */
type FormValuesInferred = z.infer<typeof baseFormSchema>;

const formSchema = baseFormSchema.superRefine((data, ctx) => {
  if (data.category === 'field') {
    // Field validations
    if (['update', 'merge', 'delete'].includes(data.type) && !data.targetField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Target field is required',
        path: ['targetField'],
      });
    }
    if (data.type === 'merge' && !data.mergeTargetField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Merge target field is required',
        path: ['mergeTargetField'],
      });
    }
    if (['create', 'update'].includes(data.type)) {
      if (!data.fieldName || data.fieldName.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Field name must be at least 2 characters',
          path: ['fieldName'],
        });
      }
      if (!data.description || data.description.length < 20) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Description must be at least 20 characters',
          path: ['description'],
        });
      }
    }
  } else if (data.category === 'contribution-type') {
    // Contribution type validations
    if (['update', 'delete'].includes(data.type) && !data.existingTypeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Existing type is required',
        path: ['existingTypeId'],
      });
    }
    if (['create', 'update'].includes(data.type)) {
      if (!data.proposedId || data.proposedId.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Type ID must be at least 2 characters',
          path: ['proposedId'],
        });
      }
      if (!data.proposedLabel || data.proposedLabel.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Label must be at least 2 characters',
          path: ['proposedLabel'],
        });
      }
      if (!data.description || data.description.length < 20) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Description must be at least 20 characters',
          path: ['description'],
        });
      }
    }
  } else if (data.category === 'facet') {
    // Facet validations
    if (['update', 'delete'].includes(data.type) && !data.existingFacetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Existing facet value is required',
        path: ['existingFacetId'],
      });
    }
    if (['create', 'update'].includes(data.type)) {
      if (!data.facetDimension) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Facet dimension is required',
          path: ['facetDimension'],
        });
      }
      if (!data.facetValueId || data.facetValueId.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Facet ID must be at least 2 characters',
          path: ['facetValueId'],
        });
      }
      if (!data.facetValueLabel || data.facetValueLabel.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Label must be at least 2 characters',
          path: ['facetValueLabel'],
        });
      }
      if (!data.description || data.description.length < 20) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Description must be at least 20 characters',
          path: ['description'],
        });
      }
    }
  } else if (data.category === 'organization') {
    // Organization validations
    if (['update', 'merge', 'delete'].includes(data.type) && !data.existingOrgId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Existing organization is required',
        path: ['existingOrgId'],
      });
    }
    if (data.type === 'merge' && !data.parentOrgId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Merge target organization is required',
        path: ['parentOrgId'],
      });
    }
    if (['create', 'update'].includes(data.type)) {
      if (!data.orgName || data.orgName.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Organization name must be at least 2 characters',
          path: ['orgName'],
        });
      }
      if (!data.orgType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Organization type is required',
          path: ['orgType'],
        });
      }
    }
  } else if (data.category === 'reconciliation') {
    // Reconciliation validations
    if (['update', 'delete'].includes(data.type) && !data.existingReconciliationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Existing reconciliation is required',
        path: ['existingReconciliationId'],
      });
    }
    if (['create', 'update'].includes(data.type)) {
      if (!data.sourceEntityType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Source entity type is required',
          path: ['sourceEntityType'],
        });
      }
      if (!data.sourceEntityUri) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Source entity is required',
          path: ['sourceEntityUri'],
        });
      }
      if (!data.targetSystem) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Target system is required',
          path: ['targetSystem'],
        });
      }
      if (!data.targetId || data.targetId.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Target identifier is required',
          path: ['targetId'],
        });
      }
      if (!data.matchType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Match type is required',
          path: ['matchType'],
        });
      }
    }
  }
});

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Unified form for creating governance proposals.
 *
 * @param props - Component props
 * @returns Proposal form element
 */
export function ProposalForm({
  onSuccess,
  onCancel,
  defaultCategory = 'field',
  defaultType = 'create',
  className,
}: ProposalFormProps) {
  const { isAuthenticated, user } = useAuth();
  const agent = useAgent();
  const createProposal = useCreateProposal();
  const { data: typesData } = useContributionTypes({ status: 'established' });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Initialize form with explicit typing
  // Using explicit type assertion to handle complex Zod refinement inference
  const form = useForm({
    resolver: zodResolver(baseFormSchema),
    defaultValues: {
      category: defaultCategory,
      type: defaultType,
      // Field-specific
      fieldName: '',
      description: '',
      fieldType: 'topic' as const,
      wikidataId: '',
      // Contribution type-specific
      proposedId: '',
      proposedLabel: '',
      creditUri: '',
      croUri: '',
      // Facet-specific
      facetValueId: '',
      facetValueLabel: '',
      lcshUri: '',
      fastUri: '',
      // Organization-specific
      orgName: '',
      rorId: '',
      country: '',
      city: '',
      website: '',
      aliases: '',
      // Reconciliation-specific
      sourceEntityUri: '',
      sourceEntityLabel: '',
      targetId: '',
      targetUri: '',
      targetLabel: '',
      // Common
      rationale: '',
    },
  });

  const category = form.watch('category');
  const proposalType = form.watch('type');
  const existingTypeId = form.watch('existingTypeId');

  // Auto-fill contribution type fields when existing type is selected
  const handleExistingTypeChange = useCallback(
    (typeId: string) => {
      const existingType = typesData?.types.find((t: CreditContributionType) => t.id === typeId);
      if (existingType) {
        form.setValue('proposedId', existingType.id);
        form.setValue('proposedLabel', existingType.label);
        form.setValue('description', existingType.description);
        const creditMapping = existingType.externalMappings.find(
          (m: { system: string }) => m.system === 'credit'
        );
        if (creditMapping) {
          form.setValue('creditUri', creditMapping.uri);
        }
      }
    },
    [form, typesData]
  );

  // Handle form submission
  const handleSubmit = useCallback(
    async (values: z.infer<typeof baseFormSchema>) => {
      if (!agent || !isAuthenticated) {
        setSubmitError('You must be logged in to create a proposal');
        return;
      }

      setIsSubmitting(true);
      setSubmitError(null);

      try {
        if (values.category === 'field') {
          // Create field proposal
          const proposalTypeMap: Record<ProposalType, 'create' | 'modify' | 'merge' | 'deprecate'> =
            {
              create: 'create',
              update: 'modify',
              merge: 'merge',
              delete: 'deprecate',
            };

          await createFieldProposalRecord(agent, {
            proposalType: proposalTypeMap[values.type],
            fieldName: values.fieldName,
            description: values.description,
            existingFieldUri: values.targetField?.id,
            mergeTargetUri: values.mergeTargetField?.id,
            parentFieldUri: values.parentField?.id,
            externalMappings: values.wikidataId
              ? [{ source: 'wikidata' as const, id: values.wikidataId }]
              : undefined,
            rationale: values.rationale,
          });

          const proposal = await createProposal.mutateAsync({
            category: 'field',
            type: values.type,
            fieldId: values.targetField?.id,
            changes: {
              label: values.fieldName,
              description: values.description,
              fieldType: values.fieldType,
              parentId: values.parentField?.id,
              mergeTargetId: values.mergeTargetField?.id,
            },
            rationale: values.rationale,
          });

          onSuccess?.(proposal);
        } else if (values.category === 'contribution-type') {
          // Create contribution type proposal
          const externalMappings: Array<{ system: string; identifier: string; uri: string }> = [];
          if (values.creditUri) {
            externalMappings.push({
              system: 'credit',
              identifier: values.proposedId,
              uri: values.creditUri,
            });
          }
          if (values.croUri) {
            const croId = values.croUri.split('/').pop() ?? '';
            externalMappings.push({
              system: 'cro',
              identifier: croId,
              uri: values.croUri,
            });
          }

          // Create the proposal record in the user's PDS
          await agent.com.atproto.repo.createRecord({
            repo: user?.did ?? '',
            collection: 'pub.chive.contribution.typeProposal',
            record: {
              $type: 'pub.chive.contribution.typeProposal',
              proposalType: values.type === 'delete' ? 'deprecate' : values.type,
              proposedId: values.proposedId,
              proposedLabel: values.proposedLabel,
              proposedDescription: values.description,
              externalMappings: externalMappings.length > 0 ? externalMappings : undefined,
              rationale: values.rationale,
              typeId: values.existingTypeId,
              createdAt: new Date().toISOString(),
            },
          });

          // Create API proposal for indexing
          const proposal = await createProposal.mutateAsync({
            category: 'contribution-type',
            type: values.type,
            fieldId: values.existingTypeId,
            changes: {
              label: values.proposedLabel,
              description: values.description,
            },
            rationale: values.rationale,
          });

          onSuccess?.(proposal);
        } else if (values.category === 'facet') {
          // Create facet value proposal
          const facetExternalMappings: Array<{ system: string; identifier: string; uri: string }> =
            [];
          if (values.lcshUri) {
            facetExternalMappings.push({
              system: 'lcsh',
              identifier: values.facetValueId,
              uri: values.lcshUri,
            });
          }
          if (values.fastUri) {
            facetExternalMappings.push({
              system: 'fast',
              identifier: values.facetValueId,
              uri: values.fastUri,
            });
          }

          // Create the proposal record in the user's PDS
          await agent.com.atproto.repo.createRecord({
            repo: user?.did ?? '',
            collection: 'pub.chive.graph.facetProposal',
            record: {
              $type: 'pub.chive.graph.facetProposal',
              proposalType: values.type === 'delete' ? 'deprecate' : values.type,
              dimension: values.facetDimension,
              proposedId: values.facetValueId,
              proposedLabel: values.facetValueLabel,
              proposedDescription: values.description,
              parentId: values.parentFacetId,
              externalMappings:
                facetExternalMappings.length > 0 ? facetExternalMappings : undefined,
              rationale: values.rationale,
              existingFacetId: values.existingFacetId,
              createdAt: new Date().toISOString(),
            },
          });

          // Create API proposal for indexing
          const proposal = await createProposal.mutateAsync({
            category: 'facet',
            type: values.type,
            fieldId: values.existingFacetId,
            changes: {
              label: values.facetValueLabel,
              description: values.description,
              dimension: values.facetDimension,
              parentId: values.parentFacetId,
            },
            rationale: values.rationale,
          });

          onSuccess?.(proposal);
        } else if (values.category === 'organization') {
          // Create organization proposal
          const aliasesArray = values.aliases
            ? values.aliases
                .split(',')
                .map((a) => a.trim())
                .filter(Boolean)
            : undefined;

          // Create the proposal record in the user's PDS
          await agent.com.atproto.repo.createRecord({
            repo: user?.did ?? '',
            collection: 'pub.chive.graph.organizationProposal',
            record: {
              $type: 'pub.chive.graph.organizationProposal',
              proposalType: values.type === 'delete' ? 'deprecate' : values.type,
              name: values.orgName,
              type: values.orgType,
              rorId: values.rorId || undefined,
              wikidataId: values.wikidataId || undefined,
              country: values.country || undefined,
              city: values.city || undefined,
              website: values.website || undefined,
              aliases: aliasesArray,
              parentId: values.parentOrgId,
              rationale: values.rationale,
              existingOrgId: values.existingOrgId,
              mergeTargetId: values.type === 'merge' ? values.parentOrgId : undefined,
              createdAt: new Date().toISOString(),
            },
          });

          // Create API proposal for indexing
          const proposal = await createProposal.mutateAsync({
            category: 'organization',
            type: values.type,
            fieldId: values.existingOrgId,
            changes: {
              label: values.orgName,
              description: values.description,
              type: values.orgType,
              rorId: values.rorId,
              country: values.country,
              city: values.city,
              website: values.website,
              parentId: values.parentOrgId,
              mergeTargetId: values.type === 'merge' ? values.parentOrgId : undefined,
            },
            rationale: values.rationale,
          });

          onSuccess?.(proposal);
        } else if (values.category === 'reconciliation') {
          // Create reconciliation proposal
          await agent.com.atproto.repo.createRecord({
            repo: user?.did ?? '',
            collection: 'pub.chive.graph.reconciliationProposal',
            record: {
              $type: 'pub.chive.graph.reconciliationProposal',
              proposalType: values.type === 'delete' ? 'remove' : values.type,
              sourceType: values.sourceEntityType,
              sourceUri: values.sourceEntityUri,
              sourceLabel: values.sourceEntityLabel,
              targetSystem: values.targetSystem,
              targetId: values.targetId,
              targetUri: values.targetUri,
              targetLabel: values.targetLabel,
              matchType: values.matchType,
              confidence: values.confidence,
              rationale: values.rationale,
              existingReconciliationId: values.existingReconciliationId,
              createdAt: new Date().toISOString(),
            },
          });

          // Create API proposal for indexing
          const proposal = await createProposal.mutateAsync({
            category: 'reconciliation',
            type: values.type,
            fieldId: values.existingReconciliationId,
            changes: {
              label: `${values.sourceEntityLabel} → ${values.targetLabel}`,
              description: values.rationale,
              sourceType: values.sourceEntityType,
              sourceUri: values.sourceEntityUri,
              targetSystem: values.targetSystem,
              targetId: values.targetId,
              targetUri: values.targetUri,
              matchType: values.matchType,
            },
            rationale: values.rationale,
          });

          onSuccess?.(proposal);
        }
      } catch (error) {
        console.error('Proposal creation error:', error);
        setSubmitError(
          error instanceof Error ? error.message : 'An error occurred while creating your proposal'
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [agent, isAuthenticated, createProposal, onSuccess]
  );

  // Handle field selection
  const handleFieldSelect =
    (fieldKey: 'targetField' | 'mergeTargetField' | 'parentField') => (field: FieldSelection) => {
      const current = form.getValues(fieldKey);
      if (!current) {
        form.setValue(fieldKey, field, { shouldValidate: true });
      }
    };

  const handleFieldRemove =
    (fieldKey: 'targetField' | 'mergeTargetField' | 'parentField') => () => {
      form.setValue(fieldKey, undefined, { shouldValidate: true });
    };

  // Get proposal types based on category
  const getProposalTypes = () => {
    switch (category) {
      case 'field':
        return FIELD_PROPOSAL_TYPES;
      case 'contribution-type':
        return CONTRIBUTION_PROPOSAL_TYPES;
      case 'facet':
        return FACET_PROPOSAL_TYPES;
      case 'organization':
        return ORGANIZATION_PROPOSAL_TYPES;
      case 'reconciliation':
        return RECONCILIATION_PROPOSAL_TYPES;
      default:
        return FIELD_PROPOSAL_TYPES;
    }
  };
  const proposalTypes = getProposalTypes();

  // Field visibility flags
  const requiresTargetField =
    category === 'field' && ['update', 'merge', 'delete'].includes(proposalType);
  const showMergeTarget = category === 'field' && proposalType === 'merge';
  const showFieldDetails = category === 'field' && ['create', 'update'].includes(proposalType);

  // Contribution type visibility flags
  const requiresExistingType =
    category === 'contribution-type' && ['update', 'delete'].includes(proposalType);
  const showContributionTypeDetails =
    category === 'contribution-type' && ['create', 'update'].includes(proposalType);

  // Facet visibility flags
  const requiresExistingFacet = category === 'facet' && ['update', 'delete'].includes(proposalType);
  const showFacetDetails = category === 'facet' && ['create', 'update'].includes(proposalType);

  // Organization visibility flags
  const requiresExistingOrg =
    category === 'organization' && ['update', 'merge', 'delete'].includes(proposalType);
  const showOrgMergeTarget = category === 'organization' && proposalType === 'merge';
  const showOrgDetails = category === 'organization' && ['create', 'update'].includes(proposalType);

  // Reconciliation visibility flags
  const requiresExistingReconciliation =
    category === 'reconciliation' && ['update', 'delete'].includes(proposalType);
  const showReconciliationDetails =
    category === 'reconciliation' && ['create', 'update'].includes(proposalType);

  return (
    <div className={cn('space-y-8', className)}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
          {/* Category Selection */}
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>What do you want to propose? *</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue('type', 'create');
                    }}
                    value={field.value}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    {CATEGORIES.map((cat) => (
                      <Label
                        key={cat.value}
                        htmlFor={`cat-${cat.value}`}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50',
                          field.value === cat.value && 'border-primary bg-primary/5'
                        )}
                      >
                        <RadioGroupItem
                          value={cat.value}
                          id={`cat-${cat.value}`}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <cat.icon className="h-4 w-4" />
                            <span className="font-medium">{cat.label}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{cat.description}</p>
                        </div>
                      </Label>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Proposal Type Selection */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Action *</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                  >
                    {proposalTypes.map((type) => (
                      <Label
                        key={type.value}
                        htmlFor={`type-${type.value}`}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50',
                          field.value === type.value && 'border-primary bg-primary/5'
                        )}
                      >
                        <RadioGroupItem
                          value={type.value}
                          id={`type-${type.value}`}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <type.icon className="h-4 w-4" />
                            <span className="font-medium">{type.label}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{type.description}</p>
                        </div>
                      </Label>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ============================================================= */}
          {/* FIELD-SPECIFIC FIELDS */}
          {/* ============================================================= */}

          {/* Target Field Selection (for update/merge/delete) */}
          {requiresTargetField && (
            <div className="space-y-4">
              <h3 className="font-medium">
                {proposalType === 'merge' ? 'Source Field' : 'Target Field'}
              </h3>
              <FieldSearch
                selectedFields={form.watch('targetField') ? [form.watch('targetField')!] : []}
                onFieldAdd={handleFieldSelect('targetField')}
                onFieldRemove={handleFieldRemove('targetField')}
                maxFields={1}
                placeholder="Search for the field to modify..."
              />
              {form.formState.errors.targetField && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.targetField.message}
                </p>
              )}
            </div>
          )}

          {/* Merge Target Field */}
          {showMergeTarget && (
            <div className="space-y-4">
              <h3 className="font-medium">Merge Into Field</h3>
              <FieldSearch
                selectedFields={
                  form.watch('mergeTargetField') ? [form.watch('mergeTargetField')!] : []
                }
                onFieldAdd={handleFieldSelect('mergeTargetField')}
                onFieldRemove={handleFieldRemove('mergeTargetField')}
                maxFields={1}
                placeholder="Search for the target field to merge into..."
              />
              {form.formState.errors.mergeTargetField && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.mergeTargetField.message}
                </p>
              )}
            </div>
          )}

          {/* Field Details (for create/update) */}
          {showFieldDetails && (
            <>
              <FormField
                control={form.control}
                name="fieldName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {proposalType === 'create' ? 'New Field Name' : 'Updated Field Name'} *
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Quantum Machine Learning"
                        maxLength={200}
                      />
                    </FormControl>
                    <FormDescription>
                      A clear, descriptive name for the field (2-200 characters)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Field Description *</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe what this field covers, its scope, and relationship to other fields..."
                        rows={4}
                        maxLength={5000}
                      />
                    </FormControl>
                    <FormDescription>
                      {field.value?.length ?? 0}/5000 characters (minimum 20)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fieldType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Field Category *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select field category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FIELD_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div>
                              <span className="font-medium">{type.label}</span>
                              <span className="ml-2 text-muted-foreground">
                                - {type.description}
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

              {proposalType === 'create' && (
                <div className="space-y-4">
                  <h3 className="font-medium">
                    Parent Field{' '}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </h3>
                  <FieldSearch
                    selectedFields={form.watch('parentField') ? [form.watch('parentField')!] : []}
                    onFieldAdd={handleFieldSelect('parentField')}
                    onFieldRemove={handleFieldRemove('parentField')}
                    maxFields={1}
                    placeholder="Search for parent field..."
                    helpText="Select a parent field for hierarchical organization"
                  />
                </div>
              )}

              <FormField
                control={form.control}
                name="wikidataId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Wikidata ID{' '}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Q12345" className="font-mono" />
                    </FormControl>
                    <FormDescription>
                      Link to a Wikidata entity for authority control (e.g., Q2539 for Machine
                      Learning)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {/* ============================================================= */}
          {/* CONTRIBUTION TYPE-SPECIFIC FIELDS */}
          {/* ============================================================= */}

          {/* Existing Type Selection (for update/deprecate) */}
          {requiresExistingType && (
            <FormField
              control={form.control}
              name="existingTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Existing Contribution Type *</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleExistingTypeChange(value);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a contribution type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {typesData?.types.map((type: CreditContributionType) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the contribution type you want to{' '}
                    {proposalType === 'update' ? 'update' : 'deprecate'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Contribution Type Details (for create/update) */}
          {showContributionTypeDetails && (
            <>
              <FormField
                control={form.control}
                name="proposedId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type ID *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., clinical-trials"
                        maxLength={50}
                        className="font-mono"
                        disabled={proposalType === 'update' && !!existingTypeId}
                      />
                    </FormControl>
                    <FormDescription>
                      A unique identifier using lowercase letters, numbers, and hyphens
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="proposedLabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Clinical Trials" maxLength={100} />
                    </FormControl>
                    <FormDescription>Human-readable name for the contribution type</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description *</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe what this contribution type covers and when it should be used..."
                        rows={4}
                        maxLength={1000}
                      />
                    </FormControl>
                    <FormDescription>
                      {field.value?.length ?? 0}/1000 characters (minimum 20)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">External Mappings (Optional)</h4>
                <p className="text-sm text-muted-foreground">
                  Link to external ontologies for interoperability
                </p>

                <FormField
                  control={form.control}
                  name="creditUri"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        CRediT URI{' '}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="https://credit.niso.org/contributor-roles/..."
                          className="font-mono text-sm"
                        />
                      </FormControl>
                      <FormDescription className="flex items-center gap-1">
                        <a
                          href="https://credit.niso.org/contributor-roles/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Browse CRediT roles
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="croUri"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        CRO URI{' '}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="http://purl.obolibrary.org/obo/CRO_..."
                          className="font-mono text-sm"
                        />
                      </FormControl>
                      <FormDescription className="flex items-center gap-1">
                        <a
                          href="https://www.ebi.ac.uk/ols/ontologies/cro"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Browse CRO
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </>
          )}

          {/* ============================================================= */}
          {/* FACET-SPECIFIC FIELDS */}
          {/* ============================================================= */}

          {/* Existing Facet Selection (for update/delete) */}
          {requiresExistingFacet && (
            <FormField
              control={form.control}
              name="existingFacetId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Existing Facet Value *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter the facet value ID to modify..."
                      className="font-mono"
                    />
                  </FormControl>
                  <FormDescription>
                    The ID of the facet value you want to{' '}
                    {proposalType === 'update' ? 'update' : 'deprecate'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Facet Details (for create/update) */}
          {showFacetDetails && (
            <>
              <FormField
                control={form.control}
                name="facetDimension"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Facet Dimension *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select facet dimension" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          PMEST Dimensions
                        </div>
                        {PMEST_DIMENSIONS.map((dim) => (
                          <SelectItem key={dim.value} value={dim.value}>
                            <div>
                              <span className="font-medium">{dim.label}</span>
                              <span className="ml-2 text-muted-foreground">
                                - {dim.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                          FAST Entity Facets
                        </div>
                        {FAST_DIMENSIONS.map((dim) => (
                          <SelectItem key={dim.value} value={dim.value}>
                            <div>
                              <span className="font-medium">{dim.label}</span>
                              <span className="ml-2 text-muted-foreground">
                                - {dim.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      PMEST (Ranganathan) or FAST (Library of Congress) classification dimension
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="facetValueId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Facet Value ID *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., machine-learning"
                        maxLength={50}
                        className="font-mono"
                      />
                    </FormControl>
                    <FormDescription>
                      A unique identifier using lowercase letters, numbers, and hyphens
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="facetValueLabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Facet Value Label *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Machine Learning" maxLength={200} />
                    </FormControl>
                    <FormDescription>Human-readable name for the facet value</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description *</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe what this facet value represents and when it should be used..."
                        rows={4}
                        maxLength={2000}
                      />
                    </FormControl>
                    <FormDescription>
                      {field.value?.length ?? 0}/2000 characters (minimum 20)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parentFacetId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Parent Facet Value{' '}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., artificial-intelligence"
                        className="font-mono"
                      />
                    </FormControl>
                    <FormDescription>
                      ID of parent facet value for hierarchical organization
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">External Mappings (Optional)</h4>
                <p className="text-sm text-muted-foreground">
                  Link to Library of Congress controlled vocabularies
                </p>

                <FormField
                  control={form.control}
                  name="lcshUri"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        LCSH URI{' '}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="http://id.loc.gov/authorities/subjects/..."
                          className="font-mono text-sm"
                        />
                      </FormControl>
                      <FormDescription className="flex items-center gap-1">
                        <a
                          href="https://id.loc.gov/authorities/subjects.html"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Browse LCSH
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fastUri"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        FAST URI{' '}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="http://id.worldcat.org/fast/..."
                          className="font-mono text-sm"
                        />
                      </FormControl>
                      <FormDescription className="flex items-center gap-1">
                        <a
                          href="https://www.oclc.org/research/areas/data-science/fast.html"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Browse FAST
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </>
          )}

          {/* ============================================================= */}
          {/* ORGANIZATION-SPECIFIC FIELDS */}
          {/* ============================================================= */}

          {/* Existing Organization Selection (for update/merge/delete) */}
          {requiresExistingOrg && (
            <FormField
              control={form.control}
              name="existingOrgId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {proposalType === 'merge' ? 'Source Organization' : 'Existing Organization'} *
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter organization ID or ROR ID..."
                      className="font-mono"
                    />
                  </FormControl>
                  <FormDescription>
                    The ID of the organization you want to{' '}
                    {proposalType === 'update'
                      ? 'update'
                      : proposalType === 'merge'
                        ? 'merge'
                        : 'deprecate'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Organization Merge Target */}
          {showOrgMergeTarget && (
            <FormField
              control={form.control}
              name="parentOrgId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Merge Into Organization *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter target organization ID or ROR ID..."
                      className="font-mono"
                    />
                  </FormControl>
                  <FormDescription>The organization to merge the source into</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Organization Details (for create/update) */}
          {showOrgDetails && (
            <>
              <FormField
                control={form.control}
                name="orgName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Massachusetts Institute of Technology"
                        maxLength={300}
                      />
                    </FormControl>
                    <FormDescription>Official name of the organization</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="orgType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select organization type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ORGANIZATION_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="rorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        ROR ID <span className="font-normal text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="https://ror.org/..."
                          className="font-mono text-sm"
                        />
                      </FormControl>
                      <FormDescription className="flex items-center gap-1">
                        <a
                          href="https://ror.org/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Search ROR
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="wikidataId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Wikidata ID{' '}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Q12345" className="font-mono" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Country Code{' '}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="US" maxLength={2} className="uppercase" />
                      </FormControl>
                      <FormDescription>ISO 3166-1 alpha-2 code</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        City <span className="font-normal text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Cambridge" maxLength={100} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Website <span className="font-normal text-muted-foreground">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://www.example.edu" type="url" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="aliases"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Aliases <span className="font-normal text-muted-foreground">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="MIT, M.I.T., Massachusetts Tech" />
                    </FormControl>
                    <FormDescription>
                      Comma-separated alternative names or abbreviations
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {proposalType === 'create' && (
                <FormField
                  control={form.control}
                  name="parentOrgId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Parent Organization{' '}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter parent organization ID..."
                          className="font-mono"
                        />
                      </FormControl>
                      <FormDescription>
                        ID of parent organization for hierarchical relationships
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </>
          )}

          {/* ============================================================= */}
          {/* RECONCILIATION-SPECIFIC FIELDS */}
          {/* ============================================================= */}

          {/* Existing Reconciliation (for update/delete) */}
          {requiresExistingReconciliation && (
            <FormField
              control={form.control}
              name="existingReconciliationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Existing Reconciliation *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter reconciliation ID..."
                      className="font-mono"
                    />
                  </FormControl>
                  <FormDescription>
                    The ID of the reconciliation you want to{' '}
                    {proposalType === 'update' ? 'update' : 'remove'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Reconciliation Details (for create/update) */}
          {showReconciliationDetails && (
            <>
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Source Entity (Chive)
                </h4>

                <FormField
                  control={form.control}
                  name="sourceEntityType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entity Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select entity type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {RECONCILABLE_ENTITY_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sourceEntityUri"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entity URI *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="at://did:plc:.../..."
                          className="font-mono text-sm"
                        />
                      </FormControl>
                      <FormDescription>
                        AT-URI or ID of the Chive entity to reconcile
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sourceEntityLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entity Label *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Machine Learning" />
                      </FormControl>
                      <FormDescription>Human-readable name for reference</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Target Entity (External)
                </h4>

                <FormField
                  control={form.control}
                  name="targetSystem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>External System *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select external system" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {RECONCILIATION_SYSTEMS.map((sys) => (
                            <SelectItem key={sys.value} value={sys.value}>
                              <div>
                                <span className="font-medium">{sys.label}</span>
                                <span className="ml-2 text-muted-foreground">
                                  - {sys.description}
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

                <FormField
                  control={form.control}
                  name="targetId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>External Identifier *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Q2539 (Wikidata) or 02mhbdp94 (ROR)"
                          className="font-mono"
                        />
                      </FormControl>
                      <FormDescription>Identifier in the external system</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetUri"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        External URI{' '}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="https://www.wikidata.org/wiki/Q2539"
                          className="font-mono text-sm"
                        />
                      </FormControl>
                      <FormDescription>Full URI to the external entity</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>External Label *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., machine learning" />
                      </FormControl>
                      <FormDescription>Label from the external system</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4 p-4 border rounded-lg">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Match Details
                </h4>

                <FormField
                  control={form.control}
                  name="matchType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Match Type (SKOS Relation) *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select match type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MATCH_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div>
                                <span className="font-medium">{type.label}</span>
                                <span className="ml-2 text-muted-foreground">
                                  - {type.description}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Based on SKOS mapping relations for semantic interoperability
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confidence"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Confidence Score{' '}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={0}
                          max={1}
                          step={0.01}
                          placeholder="0.95"
                          onChange={(e) =>
                            field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Confidence level from 0 to 1 (e.g., 0.95 = 95% confident)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </>
          )}

          {/* ============================================================= */}
          {/* COMMON FIELDS */}
          {/* ============================================================= */}

          {/* Rationale */}
          <FormField
            control={form.control}
            name="rationale"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rationale *</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Explain why this change is needed and its benefit..."
                    rows={4}
                    maxLength={2000}
                  />
                </FormControl>
                <FormDescription>
                  Explain your reasoning ({field.value?.length ?? 0}/2000 characters)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Submit error */}
          {submitError && (
            <Alert variant="destructive">
              <AlertTitle>Submission Failed</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {/* Info about voting */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Community Voting</AlertTitle>
            <AlertDescription>
              Your proposal will be reviewed by the community. It needs weighted approval with
              minimum votes to be accepted. Domain experts and reviewers have higher voting weight.
            </AlertDescription>
          </Alert>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              {onCancel && (
                <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
                  Cancel
                </Button>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting || !isAuthenticated}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Proposal
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
