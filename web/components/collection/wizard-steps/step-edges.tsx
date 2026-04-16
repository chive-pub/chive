'use client';

/**
 * Edges step for the collection wizard.
 *
 * @remarks
 * Step 3: Define inter-item relationships using knowledge graph relation types.
 *
 * @packageDocumentation
 */

import { useState, useCallback, useEffect } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { X, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NodeAutocomplete, type NodeSuggestion } from '@/components/forms/node-autocomplete';
import { useCreatePersonalNode } from '@/lib/hooks/use-personal-graph';

import type { CollectionFormValues, CollectionEdgeFormData } from './types';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Converts a kebab-case slug to a human-readable label.
 *
 * @param slug - Kebab-case string (e.g., "has-part")
 * @returns Title-cased label (e.g., "Has Part")
 */
function slugToLabel(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for StepEdges component.
 */
export interface StepEdgesProps {
  /** React Hook Form instance */
  form: UseFormReturn<CollectionFormValues>;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Custom edges step: define relationships between collection items.
 *
 * @param props - Component props
 * @returns Edges step element
 */
export function StepEdges({ form }: StepEdgesProps) {
  const { setValue, watch } = form;
  const items = watch('items') ?? [];
  const edges = watch('edges') ?? [];

  const [sourceUri, setSourceUri] = useState('');
  const [targetUri, setTargetUri] = useState('');
  const [selectedRelation, setSelectedRelation] = useState<NodeSuggestion | null>(null);
  const [edgeNote, setEdgeNote] = useState('');
  const [addReverse, setAddReverse] = useState(false);

  // New relation creation form state
  const [showNewRelationForm, setShowNewRelationForm] = useState(false);
  const [newRelationLabel, setNewRelationLabel] = useState('');
  const [newRelationSymmetric, setNewRelationSymmetric] = useState(false);
  const [newRelationTransitive, setNewRelationTransitive] = useState(false);
  const [newRelationInverseSlug, setNewRelationInverseSlug] = useState('');
  /**
   * Optional Semble (Cosmik) connectionType mapping declared on the new
   * relation. Stored as an `externalIds` entry with `system: "cosmik"`. When
   * the relation is later used on an inter-item edge in a mirrored
   * collection, this value drives the `network.cosmik.connection.connectionType`.
   */
  const [newRelationCosmikType, setNewRelationCosmikType] = useState('');

  const createPersonalNode = useCreatePersonalNode();

  // Auto-set addReverse when selectedRelation changes based on metadata
  useEffect(() => {
    if (selectedRelation?.metadata?.symmetric) {
      setAddReverse(true);
    } else if (selectedRelation?.metadata?.inverseSlug) {
      setAddReverse(true);
    } else {
      setAddReverse(false);
    }
  }, [selectedRelation]);

  const addEdge = useCallback(() => {
    if (!sourceUri || !targetUri || !selectedRelation) {
      toast.error('Select source, target, and relation type.');
      return;
    }
    if (sourceUri === targetUri) {
      toast.error('Source and target must be different items.');
      return;
    }

    const relationSlug =
      (selectedRelation.metadata?.slug as string | undefined) ??
      selectedRelation.label.toLowerCase().replace(/\s+/g, '-');
    const relationUri = selectedRelation.uri;
    const hasSembleMapping =
      selectedRelation.externalIds?.some((id) => id.system === 'cosmik') ?? false;

    const newEdges: CollectionEdgeFormData[] = [];

    const forwardEdge: CollectionEdgeFormData = {
      sourceUri,
      targetUri,
      relationSlug,
      relationUri,
      relationLabel: selectedRelation.label,
      note: edgeNote || undefined,
      isBidirectional: addReverse || undefined,
      hasSembleMapping,
    };

    if (addReverse) {
      const isSymmetric = !!selectedRelation.metadata?.symmetric;
      const inverseSlug = isSymmetric
        ? relationSlug
        : (selectedRelation.metadata?.inverseSlug as string);
      const inverseLabel = isSymmetric ? selectedRelation.label : slugToLabel(inverseSlug);
      // When symmetric the inverse is the same node. For inverse-pair
      // relations the inverse URI is not known from the current selection;
      // downstream sync falls back to slug-based resolution.
      const inverseUri = isSymmetric ? relationUri : undefined;

      forwardEdge.inverseRelationSlug = inverseSlug;
      forwardEdge.inverseRelationUri = inverseUri;
      forwardEdge.inverseRelationLabel = inverseLabel;

      newEdges.push(forwardEdge);
      newEdges.push({
        sourceUri: targetUri,
        targetUri: sourceUri,
        relationSlug: inverseSlug,
        relationUri: inverseUri,
        relationLabel: inverseLabel,
        note: edgeNote || undefined,
        isBidirectional: true,
        inverseRelationSlug: relationSlug,
        inverseRelationUri: relationUri,
        inverseRelationLabel: selectedRelation.label,
        hasSembleMapping,
      });
    } else {
      newEdges.push(forwardEdge);
    }

    setValue('edges', [...edges, ...newEdges], { shouldDirty: true });
    setSourceUri('');
    setTargetUri('');
    setSelectedRelation(null);
    setEdgeNote('');
  }, [sourceUri, targetUri, selectedRelation, edgeNote, edges, setValue, addReverse]);

  const removeEdge = useCallback(
    (index: number) => {
      const edge = edges[index];
      if (edge.isBidirectional) {
        // Find and remove the paired reverse edge too
        const updated = edges.filter((e, i) => {
          if (i === index) return false;
          // Match the reverse: same source/target swapped, same or inverse relation
          if (
            e.isBidirectional &&
            e.sourceUri === edge.targetUri &&
            e.targetUri === edge.sourceUri &&
            (e.relationSlug === edge.inverseRelationSlug || e.relationSlug === edge.relationSlug)
          ) {
            return false;
          }
          return true;
        });
        setValue('edges', updated, { shouldDirty: true });
      } else {
        const updated = [...edges];
        updated.splice(index, 1);
        setValue('edges', updated, { shouldDirty: true });
      }
    },
    [edges, setValue]
  );

  const getItemLabel = useCallback(
    (uri: string): string => {
      return items.find((i) => i.uri === uri)?.label ?? uri;
    },
    [items]
  );

  const handleCreateNewRelation = useCallback((label: string) => {
    setNewRelationLabel(label);
    setShowNewRelationForm(true);
  }, []);

  const confirmCreateRelation = useCallback(async () => {
    try {
      const metadata: Record<string, unknown> = {};
      if (newRelationSymmetric) metadata.symmetric = true;
      if (newRelationTransitive) metadata.transitive = true;
      if (newRelationInverseSlug) metadata.inverseSlug = newRelationInverseSlug;

      const externalIds: Array<{
        system: string;
        identifier: string;
        uri?: string;
        matchType?: 'exact' | 'close' | 'broader' | 'narrower' | 'related';
      }> = [];
      const cosmikType = newRelationCosmikType.trim();
      if (cosmikType) {
        const normalized = cosmikType.toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');
        externalIds.push({
          system: 'cosmik',
          identifier: normalized,
          uri: `cosmik://connectionType/${normalized}`,
          matchType: 'exact',
        });
      }

      const result = await createPersonalNode.mutateAsync({
        kind: 'type',
        subkind: 'relation',
        label: newRelationLabel,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        externalIds: externalIds.length > 0 ? externalIds : undefined,
      });
      setSelectedRelation({
        id: result.uri,
        uri: result.uri,
        label: result.label,
        kind: 'type',
        subkind: 'relation',
        status: 'established',
        isPersonal: true,
        metadata,
      });
      toast.success(`Created relation type: ${newRelationLabel}`);
      setShowNewRelationForm(false);
      setNewRelationLabel('');
      setNewRelationSymmetric(false);
      setNewRelationTransitive(false);
      setNewRelationInverseSlug('');
      setNewRelationCosmikType('');
    } catch {
      toast.error('Failed to create relation type.');
    }
  }, [
    createPersonalNode,
    newRelationLabel,
    newRelationSymmetric,
    newRelationTransitive,
    newRelationInverseSlug,
    newRelationCosmikType,
  ]);

  if (items.length < 2) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Custom Edges</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Define relationships between items in your collection.
          </p>
        </div>
        <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
          <p>Add at least 2 items in the previous step to define relationships.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Custom Edges</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Define relationships between items. For example, &quot;Paper A cites Paper B&quot; or
          &quot;Author X contributed to Paper Y.&quot;
        </p>
        {form.watch('enableCosmikMirror') && form.watch('syncEdgesAsConnections') && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
              <circle cx="6" cy="6" r="6" />
            </svg>
            Edges will be synced to Semble as connections
          </div>
        )}
      </div>

      {/* Edge creation form */}
      <Card>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={sourceUri} onValueChange={setSourceUri}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.uri} value={item.uri}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target</Label>
              <Select value={targetUri} onValueChange={setTargetUri}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.uri} value={item.uri}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Relation Type</Label>
            {selectedRelation ? (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1 py-1 pl-2 pr-1">
                  <span>{selectedRelation.label}</span>
                  {selectedRelation.isPersonal && (
                    <span className="ml-1 text-[10px] font-medium text-muted-foreground bg-muted px-1 py-0.5 rounded">
                      Personal
                    </span>
                  )}
                  {selectedRelation.externalIds?.some((id) => id.system === 'cosmik') && (
                    <span className="ml-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-1 py-0.5 rounded">
                      Semble
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedRelation(null)}
                    className="ml-1 rounded-full p-0.5 hover:bg-muted"
                    aria-label="Clear relation"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              </div>
            ) : (
              <NodeAutocomplete
                kind="type"
                subkind="relation"
                includePersonal
                label="Relation"
                placeholder="Search relation types (e.g., cites, depends-on)..."
                onSelect={(node) => setSelectedRelation(node)}
                onCreateNew={handleCreateNewRelation}
              />
            )}
            {showNewRelationForm && (
              <Card className="mt-2">
                <CardContent className="space-y-3 pt-3">
                  <p className="text-sm font-medium">New relation: {newRelationLabel}</p>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={newRelationSymmetric}
                        onChange={(e) => {
                          setNewRelationSymmetric(e.target.checked);
                          if (e.target.checked) setNewRelationInverseSlug('');
                        }}
                        className="rounded"
                      />
                      Symmetric
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={newRelationTransitive}
                        onChange={(e) => setNewRelationTransitive(e.target.checked)}
                        className="rounded"
                      />
                      Transitive
                    </label>
                  </div>
                  {!newRelationSymmetric && (
                    <div className="space-y-1">
                      <Label className="text-xs">Inverse relation slug (optional)</Label>
                      <input
                        type="text"
                        value={newRelationInverseSlug}
                        onChange={(e) => setNewRelationInverseSlug(e.target.value)}
                        placeholder="e.g., narrower"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">Semble connection type (optional)</Label>
                    <input
                      type="text"
                      value={newRelationCosmikType}
                      onChange={(e) => setNewRelationCosmikType(e.target.value)}
                      placeholder="e.g., REFERENCES, BUILDS_ON"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      When edges using this relation are mirrored to Semble, the connection will use
                      this <code>connectionType</code>. Leave empty to derive from the slug.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={confirmCreateRelation}>
                      Create
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowNewRelationForm(false);
                        setNewRelationLabel('');
                        setNewRelationSymmetric(false);
                        setNewRelationTransitive(false);
                        setNewRelationInverseSlug('');
                        setNewRelationCosmikType('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Bidirectional toggle */}
          {selectedRelation &&
            !!(selectedRelation.metadata?.symmetric || selectedRelation.metadata?.inverseSlug) && (
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={addReverse}
                    onChange={(e) => setAddReverse(e.target.checked)}
                    className="rounded"
                  />
                  {selectedRelation.metadata?.symmetric
                    ? 'Add reverse edge (symmetric)'
                    : `Also add inverse edge (${slugToLabel(selectedRelation.metadata?.inverseSlug as string)})`}
                </label>
              </div>
            )}

          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea
              value={edgeNote}
              onChange={(e) => setEdgeNote(e.target.value)}
              placeholder="Describe this relationship..."
              className="min-h-[60px]"
            />
          </div>

          <Button
            type="button"
            onClick={addEdge}
            disabled={!sourceUri || !targetUri || !selectedRelation}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Edge
          </Button>
        </CardContent>
      </Card>

      {/* Edge list */}
      {edges.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Edges ({edges.length})</h3>
          {edges.map((edge, index) => {
            // Skip reverse edges of bidirectional pairs (the forward edge handles display)
            if (edge.isBidirectional) {
              const forwardIndex = edges.findIndex(
                (e, i) =>
                  i !== index &&
                  e.isBidirectional &&
                  e.sourceUri === edge.targetUri &&
                  e.targetUri === edge.sourceUri &&
                  e.inverseRelationSlug === edge.relationSlug
              );
              if (forwardIndex !== -1 && forwardIndex < index) return null;
            }

            return (
              <Card key={index}>
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm flex items-center flex-wrap gap-y-1">
                      <span className="font-medium">{getItemLabel(edge.sourceUri)}</span>
                      {edge.isBidirectional ? (
                        <span className="mx-2 text-muted-foreground">&harr;</span>
                      ) : (
                        <span className="mx-2 text-muted-foreground">&rarr;</span>
                      )}
                      <Badge variant="outline" className="mx-1">
                        {edge.relationLabel}
                        {edge.isBidirectional &&
                          edge.inverseRelationLabel &&
                          edge.inverseRelationLabel !== edge.relationLabel && (
                            <span className="text-muted-foreground">
                              {' '}
                              / {edge.inverseRelationLabel}
                            </span>
                          )}
                      </Badge>
                      {edge.hasSembleMapping && (
                        <span className="text-[9px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-1 py-0.5 rounded">
                          Semble
                        </span>
                      )}
                      {edge.isBidirectional ? (
                        <span className="mx-2 text-muted-foreground">&harr;</span>
                      ) : (
                        <span className="mx-2 text-muted-foreground">&rarr;</span>
                      )}
                      <span className="font-medium">{getItemLabel(edge.targetUri)}</span>
                    </div>
                    {edge.note && <p className="text-xs text-muted-foreground mt-1">{edge.note}</p>}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeEdge(index)}
                    aria-label="Remove edge"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {edges.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No custom edges defined. This step is optional.
        </p>
      )}
    </div>
  );
}
