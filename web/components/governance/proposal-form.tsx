'use client';

/**
 * Governance proposal form component.
 *
 * @remarks
 * Form for creating knowledge graph field proposals.
 * Supports create, update, merge, and delete proposal types.
 *
 * @example
 * ```tsx
 * <ProposalForm onSuccess={(proposal) => router.push(`/governance/proposals/${proposal.id}`)} />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Send, Loader2, Info, Plus, Merge, Edit, Trash2 } from 'lucide-react';

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
import { useCreateProposal } from '@/lib/hooks/use-governance';
import { createFieldProposalRecord } from '@/lib/atproto';
import type { ProposalType, Proposal } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Form values for proposal creation.
 */
export interface ProposalFormValues {
  /** Proposal type */
  type: ProposalType;
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
  /** Rationale for the proposal */
  rationale: string;
  /** Optional external mapping (Wikidata) */
  wikidataId?: string;
}

/**
 * Props for ProposalForm component.
 */
export interface ProposalFormProps {
  /** Callback when proposal is created successfully */
  onSuccess?: (proposal: Proposal) => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Pre-selected proposal type */
  defaultType?: ProposalType;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PROPOSAL_TYPES = [
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

const FIELD_TYPES = [
  { value: 'root', label: 'Root Field', description: 'Top-level discipline' },
  { value: 'field', label: 'Field', description: 'Major subject area' },
  { value: 'subfield', label: 'Subfield', description: 'Specialized area within a field' },
  { value: 'topic', label: 'Topic', description: 'Specific research topic' },
];

// =============================================================================
// VALIDATION SCHEMA
// =============================================================================

const formSchema = z
  .object({
    type: z.enum(['create', 'update', 'merge', 'delete']),
    targetField: z
      .object({
        id: z.string(),
        name: z.string(),
      })
      .optional(),
    mergeTargetField: z
      .object({
        id: z.string(),
        name: z.string(),
      })
      .optional(),
    fieldName: z.string().min(2, 'Field name must be at least 2 characters').max(200),
    description: z.string().min(20, 'Description must be at least 20 characters').max(5000),
    fieldType: z.enum(['field', 'root', 'subfield', 'topic']),
    parentField: z
      .object({
        id: z.string(),
        name: z.string(),
      })
      .optional(),
    rationale: z.string().min(20, 'Rationale must be at least 20 characters').max(2000),
    wikidataId: z
      .string()
      .regex(/^Q\d+$/, 'Invalid Wikidata ID format (e.g., Q12345)')
      .optional()
      .or(z.literal('')),
  })
  .refine(
    (data) => {
      // Require target field for update/merge/delete
      if (['update', 'merge', 'delete'].includes(data.type)) {
        return !!data.targetField;
      }
      return true;
    },
    { message: 'Target field is required', path: ['targetField'] }
  )
  .refine(
    (data) => {
      // Require merge target for merge type
      if (data.type === 'merge') {
        return !!data.mergeTargetField;
      }
      return true;
    },
    { message: 'Merge target field is required', path: ['mergeTargetField'] }
  );

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Form for creating governance proposals.
 *
 * @param props - Component props
 * @returns Proposal form element
 */
export function ProposalForm({
  onSuccess,
  onCancel,
  defaultType = 'create',
  className,
}: ProposalFormProps) {
  const { isAuthenticated } = useAuth();
  const agent = useAgent();
  const createProposal = useCreateProposal();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Initialize form
  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: defaultType,
      fieldName: '',
      description: '',
      fieldType: 'topic',
      rationale: '',
      wikidataId: '',
    },
  });

  const proposalType = form.watch('type');

  // Handle form submission
  const handleSubmit = useCallback(
    async (values: ProposalFormValues) => {
      if (!agent || !isAuthenticated) {
        setSubmitError('You must be logged in to create a proposal');
        return;
      }

      setIsSubmitting(true);
      setSubmitError(null);

      try {
        // Map form type to ATProto proposal type
        // Form uses 'update'/'delete', ATProto uses 'modify'/'deprecate'
        const proposalTypeMap: Record<ProposalType, 'create' | 'modify' | 'merge' | 'deprecate'> = {
          create: 'create',
          update: 'modify',
          merge: 'merge',
          delete: 'deprecate',
        };

        // Create the proposal record in the user's PDS first
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

        // Then notify Chive's API (which will index from the user's PDS)
        const proposal = await createProposal.mutateAsync({
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

  const requiresTargetField = ['update', 'merge', 'delete'].includes(proposalType);
  const showMergeTarget = proposalType === 'merge';
  const showFieldDetails = ['create', 'update'].includes(proposalType);

  return (
    <div className={cn('space-y-8', className)}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
          {/* Proposal Type Selection */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Proposal Type *</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    {PROPOSAL_TYPES.map((type) => (
                      <Label
                        key={type.value}
                        htmlFor={type.value}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50',
                          field.value === type.value && 'border-primary bg-primary/5'
                        )}
                      >
                        <RadioGroupItem value={type.value} id={type.value} className="mt-0.5" />
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
              {/* Field Name */}
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

              {/* Description */}
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
                      {field.value.length}/5000 characters (minimum 20)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Field Type */}
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

              {/* Parent Field */}
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

              {/* Wikidata ID */}
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
                    placeholder="Explain why this change is needed and its benefit to the knowledge graph..."
                    rows={4}
                    maxLength={2000}
                  />
                </FormControl>
                <FormDescription>
                  Explain your reasoning ({field.value.length}/2000 characters)
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
              Your proposal will be reviewed by the community. It needs 67% weighted approval with
              at least 3 votes to be accepted. Domain experts and reviewers have higher voting
              weight.
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
