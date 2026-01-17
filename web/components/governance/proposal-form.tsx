'use client';

/**
 * Unified governance proposal form component.
 *
 * @remarks
 * Form for creating governance proposals using the unified node/edge model.
 * Supports:
 * - Node proposals (create, update, deprecate) for any subkind
 * - Edge proposals (create relationships between nodes)
 *
 * All entities in the knowledge graph are nodes with different subkinds.
 *
 * @packageDocumentation
 */

import { useState, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Send, Loader2, Info, Plus, Edit, Trash2, Link2, Network, Tags } from 'lucide-react';

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
import { cn } from '@/lib/utils';
import { useAuth, useAgent } from '@/lib/auth/auth-context';
import { SUBKIND_LABELS } from '@/lib/hooks/use-nodes';
import type { Proposal } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Proposal entity type in the unified model.
 */
type ProposalEntityType = 'node' | 'edge';

/**
 * Node proposal type.
 */
type NodeProposalType = 'create' | 'update' | 'deprecate';

/**
 * Node kind.
 */
type NodeKind = 'type' | 'object';

/**
 * Form values for node proposal.
 */
interface NodeProposalFormValues {
  entityType: 'node';
  proposalType: NodeProposalType;
  kind: NodeKind;
  subkind: string;
  targetUri?: string;
  id: string;
  label: string;
  alternateLabels?: string;
  description: string;
  externalIds?: Array<{
    system: string;
    identifier: string;
    uri?: string;
    matchType: 'exact' | 'close' | 'broader' | 'narrower' | 'related';
  }>;
  rationale: string;
}

/**
 * Form values for edge proposal.
 */
interface EdgeProposalFormValues {
  entityType: 'edge';
  sourceUri: string;
  sourceLabel?: string;
  targetUri: string;
  targetLabel?: string;
  relationSlug: string;
  rationale: string;
}

/**
 * Combined form values.
 */
export type ProposalFormValues = NodeProposalFormValues | EdgeProposalFormValues;

/**
 * Props for ProposalForm component.
 */
export interface ProposalFormProps {
  /** Callback when proposal is created successfully */
  onSuccess?: (proposal: Proposal) => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Pre-selected entity type */
  defaultEntityType?: ProposalEntityType;
  /** Pre-selected subkind for node proposals */
  defaultSubkind?: string;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ENTITY_TYPES = [
  {
    value: 'node' as const,
    label: 'Node',
    description: 'Create or modify a knowledge graph entity',
    icon: Tags,
  },
  {
    value: 'edge' as const,
    label: 'Edge',
    description: 'Create a relationship between nodes',
    icon: Network,
  },
];

const NODE_PROPOSAL_TYPES = [
  {
    value: 'create' as const,
    label: 'Create',
    description: 'Propose a new node',
    icon: Plus,
  },
  {
    value: 'update' as const,
    label: 'Update',
    description: 'Modify an existing node',
    icon: Edit,
  },
  {
    value: 'deprecate' as const,
    label: 'Deprecate',
    description: 'Mark a node as deprecated',
    icon: Trash2,
  },
];

/**
 * Subkinds available for proposals.
 */
const PROPOSABLE_SUBKINDS: Array<{ value: string; label: string; kind: NodeKind }> = [
  // Type nodes (classifications)
  { value: 'field', label: 'Academic Field', kind: 'type' },
  { value: 'facet', label: 'Classification Facet', kind: 'type' },
  { value: 'contribution-type', label: 'Contribution Type', kind: 'type' },
  { value: 'contribution-degree', label: 'Contribution Degree', kind: 'type' },
  { value: 'document-format', label: 'Document Format', kind: 'type' },
  { value: 'license', label: 'License', kind: 'type' },
  { value: 'publication-status', label: 'Publication Status', kind: 'type' },
  { value: 'paper-type', label: 'Paper Type', kind: 'type' },
  { value: 'supplementary-category', label: 'Supplementary Category', kind: 'type' },
  { value: 'motivation', label: 'Annotation Motivation', kind: 'type' },
  { value: 'institution-type', label: 'Institution Type', kind: 'type' },
  { value: 'presentation-type', label: 'Presentation Type', kind: 'type' },
  { value: 'platform-code', label: 'Code Platform', kind: 'type' },
  { value: 'platform-data', label: 'Data Repository', kind: 'type' },
  { value: 'platform-preprint', label: 'Preprint Server', kind: 'type' },
  { value: 'platform-preregistration', label: 'Preregistration Registry', kind: 'type' },
  { value: 'platform-protocol', label: 'Protocol Repository', kind: 'type' },
  { value: 'relation', label: 'Relation Type', kind: 'type' },
  // Object nodes (instances)
  { value: 'institution', label: 'Institution', kind: 'object' },
  { value: 'person', label: 'Person', kind: 'object' },
  { value: 'event', label: 'Event', kind: 'object' },
];

/**
 * Available relation types for edge proposals.
 */
const RELATION_TYPES = [
  { value: 'broader', label: 'Broader (parent)' },
  { value: 'narrower', label: 'Narrower (child)' },
  { value: 'related', label: 'Related' },
  { value: 'equivalent', label: 'Equivalent' },
  { value: 'interdisciplinary-with', label: 'Interdisciplinary With' },
  { value: 'supersedes', label: 'Supersedes' },
  { value: 'affiliated-with', label: 'Affiliated With' },
  { value: 'located-in', label: 'Located In' },
  { value: 'part-of', label: 'Part Of' },
];

/**
 * External ID systems for node proposals.
 */
const EXTERNAL_ID_SYSTEMS = [
  { value: 'wikidata', label: 'Wikidata' },
  { value: 'ror', label: 'ROR (Research Organization Registry)' },
  { value: 'orcid', label: 'ORCID' },
  { value: 'isni', label: 'ISNI' },
  { value: 'lcsh', label: 'Library of Congress Subject Headings' },
  { value: 'fast', label: 'FAST (Faceted Application of Subject Terminology)' },
  { value: 'credit', label: 'CRediT' },
  { value: 'spdx', label: 'SPDX (Software Package Data Exchange)' },
  { value: 'fundref', label: 'FundRef' },
  {
    value: 'anzsrc',
    label: 'ANZSRC (Australian and New Zealand Standard Research Classification)',
  },
];

// =============================================================================
// SCHEMA
// =============================================================================

const nodeProposalSchema = z.object({
  entityType: z.literal('node'),
  proposalType: z.enum(['create', 'update', 'deprecate']),
  kind: z.enum(['type', 'object']),
  subkind: z.string().min(1, 'Subkind is required'),
  targetUri: z.string().optional(),
  id: z.string().min(1, 'ID is required').max(100),
  label: z.string().min(1, 'Label is required').max(500),
  alternateLabels: z.string().optional(),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  rationale: z.string().min(20, 'Rationale must be at least 20 characters').max(2000),
});

const edgeProposalSchema = z.object({
  entityType: z.literal('edge'),
  sourceUri: z.string().min(1, 'Source node is required'),
  sourceLabel: z.string().optional(),
  targetUri: z.string().min(1, 'Target node is required'),
  targetLabel: z.string().optional(),
  relationSlug: z.string().min(1, 'Relation type is required'),
  rationale: z.string().min(20, 'Rationale must be at least 20 characters').max(2000),
});

const formSchema = z.discriminatedUnion('entityType', [nodeProposalSchema, edgeProposalSchema]);

type FormValues = z.infer<typeof formSchema>;

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Unified governance proposal form.
 */
export function ProposalForm({
  onSuccess,
  onCancel,
  defaultEntityType = 'node',
  defaultSubkind,
  className,
}: ProposalFormProps) {
  const { session } = useAuth();
  const agent = useAgent();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      entityType: defaultEntityType,
      proposalType: 'create',
      kind: 'type',
      subkind: defaultSubkind ?? '',
      id: '',
      label: '',
      alternateLabels: '',
      description: '',
      rationale: '',
    } as FormValues,
  });

  const entityType = form.watch('entityType');
  const proposalType = entityType === 'node' ? form.watch('proposalType') : undefined;
  const subkind = entityType === 'node' ? form.watch('subkind') : undefined;

  // Get the selected subkind's kind
  const selectedSubkind = useMemo(
    () => PROPOSABLE_SUBKINDS.find((s) => s.value === subkind),
    [subkind]
  );

  // Update kind when subkind changes
  const handleSubkindChange = useCallback(
    (value: string) => {
      const subkind = PROPOSABLE_SUBKINDS.find((s) => s.value === value);
      if (subkind && entityType === 'node') {
        form.setValue('kind', subkind.kind);
      }
    },
    [form, entityType]
  );

  const onSubmit = useCallback(
    async (values: FormValues) => {
      if (!session || !agent) {
        setError('You must be logged in to create proposals.');
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        if (values.entityType === 'node') {
          // Create node proposal
          const result = await agent.com.atproto.repo.createRecord({
            repo: session.did,
            collection: 'pub.chive.graph.nodeProposal',
            record: {
              $type: 'pub.chive.graph.nodeProposal',
              proposalType: values.proposalType,
              kind: values.kind,
              subkind: values.subkind,
              targetUri: values.targetUri || undefined,
              proposedNode: {
                id: values.id,
                kind: values.kind,
                subkind: values.subkind,
                label: values.label,
                alternateLabels: values.alternateLabels
                  ? values.alternateLabels
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : undefined,
                description: values.description,
              },
              rationale: values.rationale,
              createdAt: new Date().toISOString(),
            },
          });

          // Create a mock Proposal object for onSuccess
          const proposal: Proposal = {
            uri: result.data.uri,
            type: values.proposalType,
            category: 'node',
            status: 'pending',
            id: values.id,
            label: values.label,
            proposedBy: session.did,
            rationale: values.rationale,
            createdAt: new Date().toISOString(),
            votes: { approve: 0, reject: 0, abstain: 0 },
          };

          onSuccess?.(proposal);
        } else {
          // Create edge proposal
          const result = await agent.com.atproto.repo.createRecord({
            repo: session.did,
            collection: 'pub.chive.graph.edgeProposal',
            record: {
              $type: 'pub.chive.graph.edgeProposal',
              proposalType: 'create',
              proposedEdge: {
                sourceUri: values.sourceUri,
                targetUri: values.targetUri,
                relationSlug: values.relationSlug,
              },
              rationale: values.rationale,
              createdAt: new Date().toISOString(),
            },
          });

          // Create a mock Proposal object for onSuccess
          const proposal: Proposal = {
            uri: result.data.uri,
            type: 'create',
            category: 'edge',
            status: 'pending',
            id: `${values.sourceUri}-${values.relationSlug}-${values.targetUri}`,
            label: `${values.sourceLabel ?? 'Source'} → ${values.relationSlug} → ${values.targetLabel ?? 'Target'}`,
            proposedBy: session.did,
            rationale: values.rationale,
            createdAt: new Date().toISOString(),
            votes: { approve: 0, reject: 0, abstain: 0 },
          };

          onSuccess?.(proposal);
        }
      } catch (err) {
        console.error('Failed to create proposal:', err);
        setError(err instanceof Error ? err.message : 'Failed to create proposal');
      } finally {
        setIsSubmitting(false);
      }
    },
    [session, agent, onSuccess]
  );

  if (!session) {
    return (
      <Alert variant="destructive">
        <Info className="h-4 w-4" />
        <AlertTitle>Authentication Required</AlertTitle>
        <AlertDescription>You must be logged in to create governance proposals.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={cn('space-y-6', className)}>
        {error && (
          <Alert variant="destructive">
            <Info className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Entity Type Selection */}
        <FormField
          control={form.control}
          name="entityType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Proposal Type</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="grid grid-cols-2 gap-4"
                >
                  {ENTITY_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                      <Label
                        key={type.value}
                        htmlFor={`entity-${type.value}`}
                        className={cn(
                          'flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer',
                          field.value === type.value && 'border-primary'
                        )}
                      >
                        <RadioGroupItem
                          value={type.value}
                          id={`entity-${type.value}`}
                          className="sr-only"
                        />
                        <Icon className="mb-2 h-6 w-6" />
                        <span className="font-medium">{type.label}</span>
                        <span className="text-xs text-muted-foreground text-center mt-1">
                          {type.description}
                        </span>
                      </Label>
                    );
                  })}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Node Proposal Fields */}
        {entityType === 'node' && (
          <>
            {/* Proposal Action Type */}
            <FormField
              control={form.control}
              name="proposalType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Action</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="flex gap-4"
                    >
                      {NODE_PROPOSAL_TYPES.map((type) => {
                        const Icon = type.icon;
                        return (
                          <Label
                            key={type.value}
                            htmlFor={`action-${type.value}`}
                            className={cn(
                              'flex items-center gap-2 rounded-md border-2 border-muted bg-popover px-4 py-2 hover:bg-accent hover:text-accent-foreground cursor-pointer',
                              field.value === type.value && 'border-primary'
                            )}
                          >
                            <RadioGroupItem
                              value={type.value}
                              id={`action-${type.value}`}
                              className="sr-only"
                            />
                            <Icon className="h-4 w-4" />
                            <span>{type.label}</span>
                          </Label>
                        );
                      })}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Subkind Selection */}
            <FormField
              control={form.control}
              name="subkind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Node Type</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleSubkindChange(value);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a node type..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        Type Nodes (Classifications)
                      </div>
                      {PROPOSABLE_SUBKINDS.filter((s) => s.kind === 'type').map((subkind) => (
                        <SelectItem key={subkind.value} value={subkind.value}>
                          {subkind.label}
                        </SelectItem>
                      ))}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                        Object Nodes (Instances)
                      </div>
                      {PROPOSABLE_SUBKINDS.filter((s) => s.kind === 'object').map((subkind) => (
                        <SelectItem key={subkind.value} value={subkind.value}>
                          {subkind.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {selectedSubkind?.kind === 'type'
                      ? 'Type nodes define classifications and categories.'
                      : selectedSubkind?.kind === 'object'
                        ? 'Object nodes are specific instances.'
                        : 'Select the type of node to propose.'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Target URI for update/deprecate */}
            {proposalType !== 'create' && (
              <FormField
                control={form.control}
                name="targetUri"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Node URI</FormLabel>
                    <FormControl>
                      <Input placeholder="at://did:plc:.../pub.chive.graph.node/..." {...field} />
                    </FormControl>
                    <FormDescription>
                      The AT-URI of the existing node to {proposalType}.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Node ID */}
            <FormField
              control={form.control}
              name="id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., machine-learning" {...field} />
                  </FormControl>
                  <FormDescription>
                    A unique identifier using lowercase letters, numbers, and hyphens.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Node Label */}
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Machine Learning" {...field} />
                  </FormControl>
                  <FormDescription>The display name for this node.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Alternate Labels */}
            <FormField
              control={form.control}
              name="alternateLabels"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alternate Labels (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., ML, Statistical Learning" {...field} />
                  </FormControl>
                  <FormDescription>
                    Comma-separated list of alternative names or abbreviations.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe this node..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A clear description of what this node represents.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {/* Edge Proposal Fields */}
        {entityType === 'edge' && (
          <>
            {/* Source Node */}
            <FormField
              control={form.control}
              name="sourceUri"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source Node URI</FormLabel>
                  <FormControl>
                    <Input placeholder="at://did:plc:.../pub.chive.graph.node/..." {...field} />
                  </FormControl>
                  <FormDescription>The AT-URI of the source node.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Relation Type */}
            <FormField
              control={form.control}
              name="relationSlug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relation Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select relation type..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {RELATION_TYPES.map((rel) => (
                        <SelectItem key={rel.value} value={rel.value}>
                          {rel.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>The type of relationship between the nodes.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Target Node */}
            <FormField
              control={form.control}
              name="targetUri"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Node URI</FormLabel>
                  <FormControl>
                    <Input placeholder="at://did:plc:.../pub.chive.graph.node/..." {...field} />
                  </FormControl>
                  <FormDescription>The AT-URI of the target node.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {/* Rationale (common to both) */}
        <FormField
          control={form.control}
          name="rationale"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rationale</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Explain why this proposal should be approved..."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>Provide a clear justification for this proposal.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Submit Buttons */}
        <div className="flex justify-end gap-3">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Send className="mr-2 h-4 w-4" />
            Submit Proposal
          </Button>
        </div>
      </form>
    </Form>
  );
}
