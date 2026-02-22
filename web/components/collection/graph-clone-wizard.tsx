'use client';

/**
 * Graph clone wizard component.
 *
 * @remarks
 * A 4-step wizard that lets users clone portions of the knowledge graph
 * into a personal collection. Steps:
 * 1. Select root nodes to start from
 * 2. Expand the subgraph with depth and edge type controls
 * 3. Curate the discovered nodes (check/uncheck, add notes)
 * 4. Save as a named collection with visibility and tags
 *
 * Follows the SubmissionWizard pattern for step navigation and progress.
 *
 * @example
 * ```tsx
 * <GraphCloneWizard onSuccess={(uri) => router.push(`/collections/${uri}`)} />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Save,
  X,
  AlertTriangle,
  Network,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  WizardProgress,
  WizardProgressCompact,
  type WizardStep,
} from '@/components/submit/wizard-progress';
import { NodeAutocomplete, type NodeSuggestion } from '@/components/forms/node-autocomplete';
import {
  useGraphSubgraph,
  useCloneSubgraph,
  type SubgraphNode,
  type SubgraphEdge,
} from '@/lib/hooks/use-graph-clone';
import { RELATION_LABELS } from '@/lib/hooks/use-edges';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Curated node with selection state and optional note.
 */
interface CuratedNode {
  uri: string;
  label: string;
  description?: string;
  kind: string;
  subkind?: string;
  depth: number;
  selected: boolean;
  note: string;
  /** Whether the note textarea is expanded */
  noteExpanded: boolean;
}

/**
 * Props for GraphCloneWizard.
 */
export interface GraphCloneWizardProps {
  /** Called with the collection URI on successful clone */
  onSuccess?: (collectionUri: string) => void;
  /** Called when user cancels */
  onCancel?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const WIZARD_STEPS: WizardStep[] = [
  { id: 'roots', title: 'Select Roots', description: 'Choose starting nodes' },
  { id: 'expand', title: 'Expand', description: 'Set depth and filters' },
  { id: 'curate', title: 'Curate', description: 'Pick nodes to include' },
  { id: 'save', title: 'Save', description: 'Name and save collection' },
];

/**
 * Common relationship types for the edge type filter.
 */
const EDGE_TYPE_OPTIONS = [
  { slug: 'broader', label: 'Broader' },
  { slug: 'narrower', label: 'Narrower' },
  { slug: 'related', label: 'Related' },
  { slug: 'part-of', label: 'Part Of' },
  { slug: 'has-part', label: 'Has Part' },
  { slug: 'interdisciplinary-with', label: 'Interdisciplinary With' },
  { slug: 'exact-match', label: 'Exact Match' },
  { slug: 'close-match', label: 'Close Match' },
  { slug: 'studies', label: 'Studies' },
  { slug: 'applies-to', label: 'Applies To' },
] as const;

// =============================================================================
// STEP 1: SELECT ROOTS
// =============================================================================

interface StepRootsProps {
  rootNodes: Array<{ uri: string; label: string }>;
  onAddRoot: (node: NodeSuggestion) => void;
  onRemoveRoot: (uri: string) => void;
}

function StepRoots({ rootNodes, onAddRoot, onRemoveRoot }: StepRootsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Select Root Nodes</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose one or more knowledge graph nodes as starting points. The wizard will expand
          outward from these roots to discover connected nodes.
        </p>
      </div>

      {/* Selected roots as badges */}
      {rootNodes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rootNodes.map((node) => (
            <Badge key={node.uri} variant="secondary" className="gap-1 py-1.5 pl-3 pr-1">
              <Network className="h-3 w-3 text-muted-foreground mr-1" />
              <span>{node.label}</span>
              <button
                type="button"
                onClick={() => onRemoveRoot(node.uri)}
                className="ml-1 rounded-full p-0.5 hover:bg-muted"
                aria-label={`Remove ${node.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Node autocomplete for adding roots */}
      <div>
        <Label className="text-sm font-medium">Add a node</Label>
        <div className="mt-1.5">
          <NodeAutocomplete
            key={rootNodes.length}
            label="Node"
            placeholder="Search for a node to start from..."
            onSelect={onAddRoot}
            onClear={() => {}}
          />
        </div>
      </div>

      {rootNodes.length === 0 && (
        <div className="rounded-lg border-2 border-dashed p-8 text-center">
          <Network className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Select at least one root node to begin building your collection.
          </p>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        {rootNodes.length} root{rootNodes.length !== 1 ? 's' : ''} selected
      </div>
    </div>
  );
}

// =============================================================================
// STEP 2: EXPAND
// =============================================================================

interface StepExpandProps {
  depth: number;
  onDepthChange: (depth: number) => void;
  selectedEdgeTypes: string[];
  onEdgeTypeToggle: (slug: string) => void;
  subgraphData: { nodes: SubgraphNode[]; edges: SubgraphEdge[]; capped: boolean } | undefined;
  isLoading: boolean;
  rootCount: number;
}

function StepExpand({
  depth,
  onDepthChange,
  selectedEdgeTypes,
  onEdgeTypeToggle,
  subgraphData,
  isLoading,
  rootCount,
}: StepExpandProps) {
  // Group nodes by depth
  const nodesByDepth = useMemo(() => {
    if (!subgraphData) return new Map<number, SubgraphNode[]>();
    const grouped = new Map<number, SubgraphNode[]>();
    for (const node of subgraphData.nodes) {
      const existing = grouped.get(node.depth) ?? [];
      existing.push(node);
      grouped.set(node.depth, existing);
    }
    return grouped;
  }, [subgraphData]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Expand Subgraph</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure how far to expand from your root nodes and which relationship types to follow.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Depth selector */}
        <div className="space-y-2">
          <Label>Expansion depth</Label>
          <Select value={String(depth)} onValueChange={(v) => onDepthChange(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 hop (direct connections)</SelectItem>
              <SelectItem value="2">2 hops</SelectItem>
              <SelectItem value="3">3 hops (wider exploration)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Higher depths discover more nodes but take longer to load.
          </p>
        </div>

        {/* Edge type filter */}
        <div className="space-y-2">
          <Label>Relationship types</Label>
          <div className="space-y-2 max-h-60 overflow-y-auto rounded-md border p-3">
            {EDGE_TYPE_OPTIONS.map((option) => (
              <div key={option.slug} className="flex items-center gap-2">
                <Checkbox
                  id={`edge-type-${option.slug}`}
                  checked={selectedEdgeTypes.includes(option.slug)}
                  onCheckedChange={() => onEdgeTypeToggle(option.slug)}
                />
                <label
                  htmlFor={`edge-type-${option.slug}`}
                  className="text-sm cursor-pointer select-none"
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {selectedEdgeTypes.length === 0
              ? 'All relationship types (no filter)'
              : `${selectedEdgeTypes.length} type${selectedEdgeTypes.length !== 1 ? 's' : ''} selected`}
          </p>
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-3">
        <Label>Preview</Label>
        {isLoading && (
          <div className="flex items-center gap-2 p-6 rounded-lg border bg-muted/30">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Expanding from {rootCount} root{rootCount !== 1 ? 's' : ''}...
            </span>
          </div>
        )}

        {!isLoading && subgraphData && (
          <div className="space-y-3">
            {/* Summary */}
            <div className="flex items-center gap-4 p-3 rounded-lg border bg-muted/30">
              <span className="text-sm font-medium">
                Found {subgraphData.nodes.length} node{subgraphData.nodes.length !== 1 ? 's' : ''}{' '}
                in {subgraphData.edges.length} edge{subgraphData.edges.length !== 1 ? 's' : ''}
              </span>
              {subgraphData.capped && (
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  100-node cap reached
                </Badge>
              )}
            </div>

            {/* Nodes grouped by hop distance */}
            {Array.from(nodesByDepth.entries())
              .sort(([a], [b]) => a - b)
              .map(([hopDepth, nodes]) => (
                <div key={hopDepth} className="space-y-1">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {hopDepth === 0
                      ? 'Root nodes'
                      : `${hopDepth} hop${hopDepth !== 1 ? 's' : ''} away`}{' '}
                    ({nodes.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {nodes.slice(0, 30).map((node) => (
                      <Badge
                        key={node.uri}
                        variant="outline"
                        className="text-xs"
                        title={node.description}
                      >
                        {node.label}
                      </Badge>
                    ))}
                    {nodes.length > 30 && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        +{nodes.length - 30} more
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}

        {!isLoading && !subgraphData && (
          <div className="rounded-lg border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
            The subgraph will be expanded when root nodes are selected.
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// STEP 3: CURATE
// =============================================================================

interface StepCurateProps {
  curatedNodes: CuratedNode[];
  onToggleNode: (uri: string) => void;
  onToggleAll: (selected: boolean) => void;
  onUpdateNote: (uri: string, note: string) => void;
  onToggleNoteExpanded: (uri: string) => void;
  onAddExtra: (node: NodeSuggestion) => void;
  selectedEdges: SubgraphEdge[];
}

function StepCurate({
  curatedNodes,
  onToggleNode,
  onToggleAll,
  onUpdateNote,
  onToggleNoteExpanded,
  onAddExtra,
  selectedEdges,
}: StepCurateProps) {
  const [showAddMore, setShowAddMore] = useState(false);

  const selectedCount = curatedNodes.filter((n) => n.selected).length;
  const totalCount = curatedNodes.length;

  // Group curated nodes by depth
  const nodesByDepth = useMemo(() => {
    const grouped = new Map<number, CuratedNode[]>();
    for (const node of curatedNodes) {
      const existing = grouped.get(node.depth) ?? [];
      existing.push(node);
      grouped.set(node.depth, existing);
    }
    return grouped;
  }, [curatedNodes]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Curate Nodes</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select which nodes to include in your collection. You can also add notes to individual
          nodes and add extra nodes that were not discovered during expansion.
        </p>
      </div>

      {/* Bulk controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => onToggleAll(true)}>
            Select all
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onToggleAll(false)}>
            Deselect all
          </Button>
        </div>
        <span className="text-sm text-muted-foreground">
          {selectedCount}/{totalCount} selected
        </span>
      </div>

      {/* Curated node list, grouped by depth */}
      <div className="space-y-4 max-h-[500px] overflow-y-auto">
        {Array.from(nodesByDepth.entries())
          .sort(([a], [b]) => a - b)
          .map(([hopDepth, nodes]) => (
            <div key={hopDepth} className="space-y-1">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider sticky top-0 bg-background py-1">
                {hopDepth === 0
                  ? 'Root nodes'
                  : hopDepth === -1
                    ? 'Manually added'
                    : `${hopDepth} hop${hopDepth !== 1 ? 's' : ''} away`}
              </h4>
              <div className="space-y-1">
                {nodes.map((node) => (
                  <div key={node.uri} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={node.selected}
                        onCheckedChange={() => onToggleNode(node.uri)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'text-sm font-medium',
                              !node.selected && 'text-muted-foreground line-through'
                            )}
                          >
                            {node.label}
                          </span>
                          {node.subkind && (
                            <Badge variant="outline" className="text-[10px]">
                              {node.subkind}
                            </Badge>
                          )}
                        </div>
                        {node.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {node.description}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 shrink-0"
                        onClick={() => onToggleNoteExpanded(node.uri)}
                        title={node.noteExpanded ? 'Collapse note' : 'Add note'}
                      >
                        {node.noteExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                    {node.noteExpanded && (
                      <Textarea
                        value={node.note}
                        onChange={(e) => onUpdateNote(node.uri, e.target.value)}
                        placeholder="Add a note about this node..."
                        className="min-h-[60px] text-sm resize-none"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>

      {/* Add more nodes */}
      <div className="space-y-2">
        {showAddMore ? (
          <div className="space-y-2">
            <Label className="text-sm">Add a node not in the subgraph</Label>
            <NodeAutocomplete
              key={curatedNodes.length}
              label="Node"
              placeholder="Search for a node to add..."
              onSelect={(node) => {
                onAddExtra(node);
                setShowAddMore(false);
              }}
              onClear={() => setShowAddMore(false)}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddMore(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowAddMore(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add more nodes
          </Button>
        )}
      </div>

      {/* Edges between selected nodes */}
      {selectedEdges.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm">Edges between selected nodes ({selectedEdges.length})</Label>
          <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
            {selectedEdges.slice(0, 50).map((edge) => {
              const sourceNode = curatedNodes.find((n) => n.uri === edge.sourceUri);
              const targetNode = curatedNodes.find((n) => n.uri === edge.targetUri);
              return (
                <div
                  key={edge.uri}
                  className="text-xs text-muted-foreground flex items-center gap-1"
                >
                  <span className="font-medium text-foreground truncate max-w-[120px]">
                    {sourceNode?.label ?? '?'}
                  </span>
                  <span className="shrink-0">
                    {RELATION_LABELS[edge.relationSlug] ?? edge.relationSlug}
                  </span>
                  <span className="font-medium text-foreground truncate max-w-[120px]">
                    {targetNode?.label ?? '?'}
                  </span>
                </div>
              );
            })}
            {selectedEdges.length > 50 && (
              <div className="text-xs text-muted-foreground">
                +{selectedEdges.length - 50} more edges
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// STEP 4: SAVE
// =============================================================================

interface StepSaveProps {
  name: string;
  onNameChange: (name: string) => void;
  description: string;
  onDescriptionChange: (description: string) => void;
  visibility: 'public' | 'unlisted' | 'private';
  onVisibilityChange: (v: 'public' | 'unlisted' | 'private') => void;
  tags: Array<{ uri: string; label: string }>;
  onAddTag: (node: NodeSuggestion) => void;
  onRemoveTag: (uri: string) => void;
  selectedNodeCount: number;
  selectedEdgeCount: number;
  isSubmitting: boolean;
  submitError: string | null;
}

function StepSave({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  visibility,
  onVisibilityChange,
  tags,
  onAddTag,
  onRemoveTag,
  selectedNodeCount,
  selectedEdgeCount,
  isSubmitting,
  submitError,
}: StepSaveProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Save Collection</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Give your collection a name and configure its visibility. The collection will contain{' '}
          {selectedNodeCount} node{selectedNodeCount !== 1 ? 's' : ''} and {selectedEdgeCount} edge
          {selectedEdgeCount !== 1 ? 's' : ''}.
        </p>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="collection-name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="collection-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g., NLP Field Map"
          maxLength={200}
          disabled={isSubmitting}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="collection-description">Description</Label>
        <Textarea
          id="collection-description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Optional: describe what this collection covers..."
          maxLength={2000}
          className="min-h-[80px] resize-none"
          disabled={isSubmitting}
        />
      </div>

      {/* Visibility */}
      <div className="space-y-2">
        <Label>Visibility</Label>
        <Select
          value={visibility}
          onValueChange={(v) => onVisibilityChange(v as 'public' | 'unlisted' | 'private')}
          disabled={isSubmitting}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">Public (anyone can find and view)</SelectItem>
            <SelectItem value="unlisted">Unlisted (accessible via link)</SelectItem>
            <SelectItem value="private">Private (only you)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label>Tags</Label>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag.uri} variant="secondary" className="gap-1 py-1 pl-2 pr-1">
                <span>{tag.label}</span>
                <button
                  type="button"
                  onClick={() => onRemoveTag(tag.uri)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                  aria-label={`Remove ${tag.label}`}
                  disabled={isSubmitting}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <NodeAutocomplete
          key={tags.length}
          subkind="tag"
          label="Tag"
          placeholder="Search for a tag..."
          includePersonal
          onSelect={onAddTag}
          onClear={() => {}}
          disabled={isSubmitting}
        />
      </div>

      {/* Error display */}
      {submitError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          {submitError}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN WIZARD
// =============================================================================

/**
 * Graph clone wizard for creating collections from knowledge graph subgraphs.
 *
 * @param props - Component props
 * @returns Wizard element
 */
export function GraphCloneWizard({ onSuccess, onCancel, className }: GraphCloneWizardProps) {
  const router = useRouter();

  // Step state
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1 state: root nodes
  const [rootNodes, setRootNodes] = useState<Array<{ uri: string; label: string }>>([]);

  // Step 2 state: expansion parameters
  const [depth, setDepth] = useState(1);
  const [selectedEdgeTypes, setSelectedEdgeTypes] = useState<string[]>([]);

  // Step 3 state: curated nodes
  const [curatedNodes, setCuratedNodes] = useState<CuratedNode[]>([]);
  const [hasInitializedCuration, setHasInitializedCuration] = useState(false);

  // Step 4 state: save form
  const [collectionName, setCollectionName] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [tags, setTags] = useState<Array<{ uri: string; label: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Subgraph expansion query
  const rootUris = useMemo(() => rootNodes.map((n) => n.uri), [rootNodes]);
  const edgeTypesForQuery = selectedEdgeTypes.length > 0 ? selectedEdgeTypes : undefined;
  const { data: subgraphData, isLoading: subgraphLoading } = useGraphSubgraph(rootUris, depth, {
    edgeTypes: edgeTypesForQuery,
    enabled: rootUris.length > 0,
  });

  // Clone mutation
  const cloneMutation = useCloneSubgraph();

  // Derive edges that connect selected nodes
  const selectedNodeUris = useMemo(
    () => new Set(curatedNodes.filter((n) => n.selected).map((n) => n.uri)),
    [curatedNodes]
  );

  const allEdges: SubgraphEdge[] = subgraphData?.edges ?? [];
  const selectedEdges = useMemo(
    () =>
      allEdges.filter(
        (e) => selectedNodeUris.has(e.sourceUri) && selectedNodeUris.has(e.targetUri)
      ),
    [allEdges, selectedNodeUris]
  );

  // Initialize curated nodes when subgraph data changes and we enter step 3
  const initializeCuration = useCallback(() => {
    if (!subgraphData) return;
    setCuratedNodes(
      subgraphData.nodes.map((node) => ({
        ...node,
        selected: true,
        note: '',
        noteExpanded: false,
      }))
    );
    setHasInitializedCuration(true);
  }, [subgraphData]);

  // ==========================================================================
  // STEP 1 HANDLERS
  // ==========================================================================

  const handleAddRoot = useCallback(
    (node: NodeSuggestion) => {
      if (rootNodes.some((r) => r.uri === node.uri)) return;
      setRootNodes((prev) => [...prev, { uri: node.uri, label: node.label }]);
      setHasInitializedCuration(false);
    },
    [rootNodes]
  );

  const handleRemoveRoot = useCallback((uri: string) => {
    setRootNodes((prev) => prev.filter((r) => r.uri !== uri));
    setHasInitializedCuration(false);
  }, []);

  // ==========================================================================
  // STEP 2 HANDLERS
  // ==========================================================================

  const handleDepthChange = useCallback((newDepth: number) => {
    setDepth(newDepth);
    setHasInitializedCuration(false);
  }, []);

  const handleEdgeTypeToggle = useCallback((slug: string) => {
    setSelectedEdgeTypes((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
    setHasInitializedCuration(false);
  }, []);

  // ==========================================================================
  // STEP 3 HANDLERS
  // ==========================================================================

  const handleToggleNode = useCallback((uri: string) => {
    setCuratedNodes((prev) =>
      prev.map((n) => (n.uri === uri ? { ...n, selected: !n.selected } : n))
    );
  }, []);

  const handleToggleAll = useCallback((selected: boolean) => {
    setCuratedNodes((prev) => prev.map((n) => ({ ...n, selected })));
  }, []);

  const handleUpdateNote = useCallback((uri: string, note: string) => {
    setCuratedNodes((prev) => prev.map((n) => (n.uri === uri ? { ...n, note } : n)));
  }, []);

  const handleToggleNoteExpanded = useCallback((uri: string) => {
    setCuratedNodes((prev) =>
      prev.map((n) => (n.uri === uri ? { ...n, noteExpanded: !n.noteExpanded } : n))
    );
  }, []);

  const handleAddExtra = useCallback(
    (node: NodeSuggestion) => {
      if (curatedNodes.some((n) => n.uri === node.uri)) return;
      setCuratedNodes((prev) => [
        ...prev,
        {
          uri: node.uri,
          label: node.label,
          description: node.description,
          kind: node.kind,
          subkind: node.subkind,
          depth: -1, // Manually added
          selected: true,
          note: '',
          noteExpanded: false,
        },
      ]);
    },
    [curatedNodes]
  );

  // ==========================================================================
  // STEP 4 HANDLERS
  // ==========================================================================

  const handleAddTag = useCallback(
    (node: NodeSuggestion) => {
      if (tags.some((t) => t.uri === node.uri)) return;
      setTags((prev) => [...prev, { uri: node.uri, label: node.label }]);
    },
    [tags]
  );

  const handleRemoveTag = useCallback((uri: string) => {
    setTags((prev) => prev.filter((t) => t.uri !== uri));
  }, []);

  // ==========================================================================
  // NAVIGATION
  // ==========================================================================

  const validateCurrentStep = useCallback((): boolean => {
    switch (currentStep) {
      case 0: // Roots
        if (rootNodes.length === 0) {
          toast.error('Select at least one root node');
          return false;
        }
        return true;
      case 1: // Expand
        if (subgraphLoading) {
          toast.error('Please wait for the subgraph to finish loading');
          return false;
        }
        if (!subgraphData || subgraphData.nodes.length === 0) {
          toast.error('No nodes found. Try adjusting your root nodes or filters.');
          return false;
        }
        return true;
      case 2: // Curate
        if (curatedNodes.filter((n) => n.selected).length === 0) {
          toast.error('Select at least one node to include');
          return false;
        }
        return true;
      case 3: // Save
        if (!collectionName.trim()) {
          toast.error('Collection name is required');
          return false;
        }
        return true;
      default:
        return true;
    }
  }, [currentStep, rootNodes, subgraphLoading, subgraphData, curatedNodes, collectionName]);

  const handleNext = useCallback(() => {
    if (!validateCurrentStep()) return;

    // Initialize curation when entering step 3 for the first time or after parameter changes
    if (currentStep === 1 && !hasInitializedCuration) {
      initializeCuration();
    }

    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, validateCurrentStep, hasInitializedCuration, initializeCuration]);

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

  // ==========================================================================
  // SUBMIT
  // ==========================================================================

  const handleSubmit = useCallback(async () => {
    if (!validateCurrentStep()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const selectedNodes = curatedNodes
        .filter((n) => n.selected)
        .map((n) => ({
          uri: n.uri,
          label: n.label,
          note: n.note || undefined,
        }));

      const edgesToClone = selectedEdges.map((e) => ({
        sourceUri: e.sourceUri,
        targetUri: e.targetUri,
        relationSlug: e.relationSlug,
      }));

      const result = await cloneMutation.mutateAsync({
        name: collectionName.trim(),
        description: collectionDescription.trim() || undefined,
        visibility,
        nodes: selectedNodes,
        edges: edgesToClone,
        tags: tags.length > 0 ? tags.map((t) => t.label) : undefined,
      });

      toast.success('Collection created', {
        description: `"${collectionName}" with ${selectedNodes.length} nodes`,
      });

      if (onSuccess) {
        onSuccess(result.collectionUri);
      } else {
        router.push(`/collections/${encodeURIComponent(result.collectionUri)}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create collection';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validateCurrentStep,
    curatedNodes,
    selectedEdges,
    cloneMutation,
    collectionName,
    collectionDescription,
    visibility,
    tags,
    onSuccess,
    router,
  ]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <StepRoots
            rootNodes={rootNodes}
            onAddRoot={handleAddRoot}
            onRemoveRoot={handleRemoveRoot}
          />
        );
      case 1:
        return (
          <StepExpand
            depth={depth}
            onDepthChange={handleDepthChange}
            selectedEdgeTypes={selectedEdgeTypes}
            onEdgeTypeToggle={handleEdgeTypeToggle}
            subgraphData={subgraphData}
            isLoading={subgraphLoading}
            rootCount={rootNodes.length}
          />
        );
      case 2:
        return (
          <StepCurate
            curatedNodes={curatedNodes}
            onToggleNode={handleToggleNode}
            onToggleAll={handleToggleAll}
            onUpdateNote={handleUpdateNote}
            onToggleNoteExpanded={handleToggleNoteExpanded}
            onAddExtra={handleAddExtra}
            selectedEdges={selectedEdges}
          />
        );
      case 3:
        return (
          <StepSave
            name={collectionName}
            onNameChange={setCollectionName}
            description={collectionDescription}
            onDescriptionChange={setCollectionDescription}
            visibility={visibility}
            onVisibilityChange={setVisibility}
            tags={tags}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            selectedNodeCount={curatedNodes.filter((n) => n.selected).length}
            selectedEdgeCount={selectedEdges.length}
            isSubmitting={isSubmitting}
            submitError={submitError}
          />
        );
      default:
        return null;
    }
  };

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  return (
    <div className={cn('space-y-8', className)}>
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clone Graph to Collection</h1>
        <p className="text-muted-foreground mt-1">
          Select nodes from the knowledge graph and save them as a personal collection.
        </p>
      </div>

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
            <Button type="button" variant="outline" onClick={handleBack} disabled={isSubmitting}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}

          {!isLastStep ? (
            <Button type="button" onClick={handleNext} disabled={subgraphLoading}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Collection
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
