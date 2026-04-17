'use client';

/**
 * Collection builder wizard component.
 *
 * @remarks
 * Multi-step form wizard for creating and editing collections.
 * Follows ATProto compliance: collection nodes and edges are written
 * to the user's PDS, never to Chive's backend. The firehose (with
 * immediate indexing as a UX optimization) handles index updates.
 *
 * Step components live in `./wizard-steps/` and are rendered based
 * on the current step index. This file handles form initialization,
 * step navigation, validation, and submission logic.
 *
 * @example
 * ```tsx
 * <CollectionWizard onSuccess={(uri) => router.push(`/collections/${uri}`)} />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { logger } from '@/lib/observability';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth, useAgent } from '@/lib/auth/auth-context';
import { WizardProgress, WizardProgressCompact } from '../submit/wizard-progress';

import {
  useCreateCollection,
  useAddToCollection,
  useAddSubcollection,
} from '@/lib/hooks/use-collections';
import { useCreatePersonalEdge, useCreatePersonalNode } from '@/lib/hooks/use-personal-graph';

import { StepBasics } from './wizard-steps/step-basics';
import { StepItems } from './wizard-steps/step-items';
import { StepEdges } from './wizard-steps/step-edges';
import { StepStructure } from './wizard-steps/step-structure';
import { StepCosmik } from './wizard-steps/step-cosmik';
import { StepReview } from './wizard-steps/step-review';
import {
  collectionFormSchema,
  stepSchemas,
  WIZARD_STEPS,
  type CollectionFormValues,
  type CollectionWizardProps,
} from './wizard-steps/types';

// Re-export types so external consumers can import from this file
export type {
  CollectionFormValues,
  CollectionItemFormData,
  CollectionEdgeFormData,
  SubcollectionFormData,
  CollectionWizardProps,
} from './wizard-steps/types';

const wizardLogger = logger.child({ component: 'collection-wizard' });

// =============================================================================
// MAIN WIZARD COMPONENT
// =============================================================================

/**
 * Multi-step collection builder wizard.
 *
 * @param props - Component props
 * @returns Collection wizard element
 */
export function CollectionWizard({
  onSuccess,
  onCancel,
  initialValues,
  isEditMode = false,
  existingUri,
  className,
}: CollectionWizardProps) {
  const { isAuthenticated } = useAuth();
  const agent = useAgent();

  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createCollection = useCreateCollection();
  const createPersonalNode = useCreatePersonalNode();
  const addToCollection = useAddToCollection();
  const addSubcollectionMutation = useAddSubcollection();
  const createPersonalEdge = useCreatePersonalEdge();

  const form = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionFormSchema) as never,
    mode: 'onChange',
    defaultValues: {
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? '',
      visibility: initialValues?.visibility ?? 'listed',
      tags: initialValues?.tags ?? [],
      fields: initialValues?.fields ?? [],
      items: initialValues?.items ?? [],
      edges: initialValues?.edges ?? [],
      subcollections: initialValues?.subcollections ?? [],
      enableCosmikMirror: initialValues?.enableCosmikMirror ?? false,
    },
  });

  const currentStepKey = WIZARD_STEPS[currentStep].id as keyof typeof stepSchemas;

  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    const schema = stepSchemas[currentStepKey];
    if (!schema) return true;

    const values = form.getValues();
    const result = schema.safeParse(values);

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const path = issue.path.join('.') as keyof CollectionFormValues;
        form.setError(path, { message: issue.message });
      });
      return false;
    }

    return true;
  }, [form, currentStepKey]);

  // Trigger full form validation when entering the review step
  useEffect(() => {
    if (currentStep === WIZARD_STEPS.length - 1) {
      form.trigger();
    }
  }, [currentStep, form]);

  const handleNext = useCallback(async () => {
    const isValid = await validateCurrentStep();
    if (isValid && currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, validateCurrentStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleStepClick = useCallback(
    (stepIndex: number) => {
      if (stepIndex < currentStep) {
        setCurrentStep(stepIndex);
      }
    },
    [currentStep]
  );

  const handleSubmit = useCallback(async () => {
    if (!agent || !isAuthenticated) {
      setSubmitError('You must be logged in to create a collection.');
      return;
    }

    const isValid = await form.trigger();
    if (!isValid) {
      setSubmitError('Please fix all validation errors before submitting.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const values = form.getValues();

      // 1. Create the collection node (with Cosmik mirror items if enabled)
      const collection = await createCollection.mutateAsync({
        name: values.name,
        description: values.description,
        visibility: values.visibility,
        tags: values.tags.length > 0 ? values.tags : undefined,
        enableCosmikMirror: values.enableCosmikMirror || undefined,
        items:
          values.enableCosmikMirror && values.items.length > 0
            ? values.items.map((item) => ({
                uri: item.uri,
                label: item.label,
                note: item.note,
                type: item.type,
                metadata: item.metadata,
              }))
            : undefined,
        collaborators: values.cosmikCollaborators?.length ? values.cosmikCollaborators : undefined,
      });

      // Create native Chive collaboration invites for each DID. This lives in
      // the owner's PDS and grants permission only when the invitee accepts
      // via `pub.chive.collaboration.inviteAcceptance`. The `collaborators[]`
      // field written to the Cosmik mirror above is the Semble-side allowlist
      // equivalent.
      if (values.cosmikCollaborators?.length) {
        try {
          const { createInviteRecord } = await import('@/lib/atproto/record-creator');
          for (const invitee of values.cosmikCollaborators) {
            try {
              await createInviteRecord(agent, {
                subjectUri: collection.uri,
                subjectCid: collection.cid,
                invitee,
                role: 'collaborator',
              });
            } catch (inviteErr) {
              wizardLogger.warn('Failed to create collaboration invite', {
                collectionUri: collection.uri,
                invitee,
                error: inviteErr instanceof Error ? inviteErr.message : String(inviteErr),
              });
            }
          }
        } catch (err) {
          wizardLogger.warn('Invite batch failed to load record-creator module', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      wizardLogger.info('Collection node created', { uri: collection.uri });

      // 2. Create personal graph nodes for all items, building a URI mapping.
      // Every collection item must be a pub.chive.graph.node in the user's PDS.
      const uriMap = new Map<string, string>(); // original URI -> personal node URI

      for (const item of values.items) {
        try {
          // Already-personal graph nodes can be used directly
          if (item.type === 'graphNode' && item.metadata?.isPersonal) {
            uriMap.set(item.uri, item.uri);
            continue;
          }

          let nodeInput: {
            kind: string;
            subkind: string;
            label: string;
            description?: string;
            metadata?: Record<string, unknown>;
          };

          if (item.type === 'eprint') {
            nodeInput = {
              kind: 'object',
              subkind: 'eprint',
              label: item.label,
              metadata: {
                eprintUri: item.uri,
                ...(item.metadata?.authors && { authors: item.metadata.authors }),
              },
            };
          } else if (item.type === 'author') {
            nodeInput = {
              kind: 'object',
              subkind: 'person',
              label: item.label,
              metadata: {
                did: item.uri.startsWith('did:') ? item.uri : item.uri.split('/')[2],
                ...(item.metadata?.handle && { handle: item.metadata.handle }),
                ...(item.metadata?.avatarUrl && { avatarUrl: item.metadata.avatarUrl }),
              },
            };
          } else if (item.type === 'graphNode') {
            // Build metadata based on item source
            const meta: Record<string, unknown> = {};

            if (item.metadata?.rorId) {
              // ROR institution (not from Chive graph)
              meta.rorId = item.metadata.rorId;
              meta.rorLabel = item.metadata.rorLabel;
            } else if (item.metadata?.conferenceName) {
              // Custom event (not from Chive graph)
              meta.conferenceName = item.metadata.conferenceName;
              if (item.metadata.conferenceAcronym) {
                meta.conferenceAcronym = item.metadata.conferenceAcronym;
              }
            } else {
              // Community graph node: clone into personal graph
              meta.clonedFrom = item.uri;
            }

            nodeInput = {
              kind: item.metadata?.kind ?? 'object',
              subkind: item.metadata?.subkind ?? 'concept',
              label: item.label,
              description: item.metadata?.description,
              metadata: meta,
            };
          } else {
            // at-uri or unknown: create a reference node
            nodeInput = {
              kind: 'object',
              subkind: 'reference',
              label: item.label,
              metadata: { referenceUri: item.uri },
            };
          }

          const personalNode = await createPersonalNode.mutateAsync(nodeInput);
          uriMap.set(item.uri, personalNode.uri);

          wizardLogger.info('Created personal node for item', {
            originalUri: item.uri,
            personalUri: personalNode.uri,
            type: item.type,
          });
        } catch (nodeError) {
          wizardLogger.warn('Failed to create personal node for item', {
            itemUri: item.uri,
            error: nodeError instanceof Error ? nodeError.message : String(nodeError),
          });
          // Fall back to using the original URI
          uriMap.set(item.uri, item.uri);
        }
      }

      // 2b. Patch cosmikItems with personalNodeUri so card lookups work at update time
      if (values.enableCosmikMirror && uriMap.size > 0) {
        try {
          const { patchCosmikItemsWithPersonalNodeUris } =
            await import('@/lib/atproto/record-creator');
          await patchCosmikItemsWithPersonalNodeUris(agent, collection.uri, uriMap);
        } catch (patchErr) {
          wizardLogger.warn('Failed to patch cosmikItems with personalNodeUri', {
            error: patchErr instanceof Error ? patchErr.message : String(patchErr),
          });
        }
      }

      // 3. Add each item to the collection via CONTAINS edge using personal node URIs
      for (let i = 0; i < values.items.length; i++) {
        const item = values.items[i];
        const personalNodeUri = uriMap.get(item.uri) ?? item.uri;
        try {
          await addToCollection.mutateAsync({
            collectionUri: collection.uri,
            itemUri: personalNodeUri,
            label: item.label,
            note: item.note,
            order: i,
            // Cosmik dual-write: create Semble cards when mirror is active
            cosmikCollectionUri: collection.cosmikCollectionUri,
            cosmikCollectionCid: collection.cosmikCollectionCid,
            itemUrl: item.uri,
            itemTitle: item.label,
            itemType: item.type,
          });
        } catch (itemError) {
          wizardLogger.warn('Failed to add item to collection', {
            itemUri: personalNodeUri,
            error: itemError instanceof Error ? itemError.message : String(itemError),
          });
        }
      }

      // 4. Create subcollections and link them
      for (const sub of values.subcollections) {
        try {
          // Create child collection node (inherit Semble mirror from parent)
          const subcollectionItems = sub.items.map((originalUri) => {
            const personalNodeUri = uriMap.get(originalUri) ?? originalUri;
            const matchingItem = values.items.find((it) => it.uri === originalUri);
            return {
              uri: personalNodeUri,
              type: matchingItem?.type ?? 'graphNode',
              label: matchingItem?.label ?? '',
              metadata: matchingItem?.metadata,
            };
          });

          const childCollection = await createCollection.mutateAsync({
            name: sub.name,
            visibility: values.visibility,
            enableCosmikMirror: values.enableCosmikMirror,
            items: values.enableCosmikMirror ? subcollectionItems : undefined,
          });

          // Link child to parent
          await addSubcollectionMutation.mutateAsync({
            childCollectionUri: childCollection.uri,
            parentCollectionUri: collection.uri,
          });

          // Add items to subcollection using remapped URIs
          for (let i = 0; i < sub.items.length; i++) {
            const originalItemUri = sub.items[i];
            const personalNodeUri = uriMap.get(originalItemUri) ?? originalItemUri;
            try {
              const matchingItem = values.items.find((it) => it.uri === originalItemUri);
              await addToCollection.mutateAsync({
                collectionUri: childCollection.uri,
                itemUri: personalNodeUri,
                label: matchingItem?.label,
                order: i,
                cosmikCollectionUri: childCollection.cosmikCollectionUri,
                cosmikCollectionCid: childCollection.cosmikCollectionCid,
                itemUrl: originalItemUri,
                itemTitle: matchingItem?.label,
                itemType: matchingItem?.type,
              });
            } catch {
              wizardLogger.warn('Failed to add item to subcollection', {
                itemUri: personalNodeUri,
                subcollection: sub.name,
              });
            }
          }
        } catch (subError) {
          wizardLogger.warn('Failed to create subcollection', {
            name: sub.name,
            error: subError instanceof Error ? subError.message : String(subError),
          });
        }
      }

      // 5. Create custom edges using remapped URIs, then dual-write to Semble
      //    as network.cosmik.connection records when the collection is mirrored.
      const ownerDid = (agent as unknown as { did?: string }).did ?? '';
      for (const edge of values.edges ?? []) {
        try {
          const personalEdge = await createPersonalEdge.mutateAsync({
            sourceUri: uriMap.get(edge.sourceUri) ?? edge.sourceUri,
            targetUri: uriMap.get(edge.targetUri) ?? edge.targetUri,
            relationSlug: edge.relationSlug,
            metadata: edge.note ? { note: edge.note } : undefined,
            ownerDid,
            // Pass through the relation node's URI so syncEdgeToCosmik can
            // resolve its `externalIds` to a Cosmik connectionType.
            relationUri: edge.relationUri,
            // Pass the parent collection URI so the edge hook can dual-write.
            collectionUri: collection.uri,
            // Pass the wizard-original URIs for endpoint URL resolution.
            originalSourceUri: edge.sourceUri,
            originalTargetUri: edge.targetUri,
          });

          wizardLogger.debug('Created personal edge', {
            edgeUri: personalEdge.uri,
            collectionUri: collection.uri,
          });
        } catch (edgeError) {
          wizardLogger.warn('Failed to create custom edge', {
            sourceUri: edge.sourceUri,
            targetUri: edge.targetUri,
            error: edgeError instanceof Error ? edgeError.message : String(edgeError),
          });
        }
      }

      toast.success(isEditMode ? 'Collection updated!' : 'Collection created!');
      onSuccess?.(collection);
    } catch (error) {
      wizardLogger.error('Collection creation error', error);
      setSubmitError(
        error instanceof Error ? error.message : 'An error occurred while creating the collection.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    agent,
    isAuthenticated,
    form,
    createCollection,
    createPersonalNode,
    addToCollection,
    addSubcollectionMutation,
    createPersonalEdge,
    isEditMode,
    onSuccess,
  ]);

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <StepBasics form={form} />;
      case 1:
        return <StepItems form={form} />;
      case 2:
        return <StepEdges form={form} />;
      case 3:
        return <StepStructure form={form} />;
      case 4:
        return <StepCosmik form={form} />;
      case 5:
        return <StepReview form={form} isSubmitting={isSubmitting} submitError={submitError} />;
      default:
        return null;
    }
  };

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  return (
    <div className={cn('space-y-8', className)}>
      {/* Progress indicator: desktop */}
      <div className="hidden md:block">
        <WizardProgress
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          onStepClick={handleStepClick}
        />
      </div>

      {/* Progress indicator: mobile */}
      <div className="md:hidden">
        <WizardProgressCompact steps={WIZARD_STEPS} currentStep={currentStep} />
      </div>

      {/* Form wrapper */}
      <FormProvider {...form}>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          {/* Step content */}
          <div className="min-h-[400px]">{renderStepContent()}</div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              {onCancel && (
                <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
                  Cancel
                </Button>
              )}
            </div>

            <div className="flex gap-3">
              {!isFirstStep && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={isSubmitting}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}

              {!isLastStep ? (
                <Button type="button" onClick={handleNext}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !isAuthenticated}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isEditMode ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      {isEditMode ? 'Update Collection' : 'Create Collection'}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
