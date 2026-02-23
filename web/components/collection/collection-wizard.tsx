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
 * @example
 * ```tsx
 * <CollectionWizard onSuccess={(uri) => router.push(`/collections/${uri}`)} />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  ArrowRight,
  Send,
  Loader2,
  X,
  Plus,
  GripVertical,
  ChevronDown,
  ChevronUp,
  FolderPlus,
  Link2,
  FileText,
  User,
  Globe,
  Hash,
  Search,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';

import { logger } from '@/lib/observability';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAuth, useAgent } from '@/lib/auth/auth-context';
import { WizardProgress, WizardProgressCompact, type WizardStep } from '../submit/wizard-progress';

import { NodeAutocomplete, type NodeSuggestion } from '@/components/forms/node-autocomplete';
import { TagAutocomplete } from '@/components/forms/tag-autocomplete';
import { FieldSearch, type FieldSelection } from '@/components/forms/field-search';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import {
  useCreateCollection,
  useAddToCollection,
  useAddSubcollection,
  type CollectionView,
} from '@/lib/hooks/use-collections';
import { useCreatePersonalEdge, useCreatePersonalNode } from '@/lib/hooks/use-personal-graph';
import { useInstantSearch } from '@/lib/hooks/use-search';
import { useAuthorSearch, type AuthorSearchResult } from '@/lib/hooks/use-author';
import { useDebounce } from '@/lib/hooks/use-eprint-search';
import { SUBKIND_BY_SLUG } from '@/components/knowledge-graph/types';
import type { EnrichedSearchHit } from '@/lib/api/schema';

const wizardLogger = logger.child({ component: 'collection-wizard' });

// =============================================================================
// TYPES
// =============================================================================

/**
 * A collection item in the wizard form.
 */
export interface CollectionItemFormData {
  /** AT-URI of the item */
  uri: string;
  /** Item type for display and CONTAINS edge metadata */
  type: string;
  /** Display label */
  label: string;
  /** Optional annotation note */
  note?: string;
  /** Optional metadata for richer rendering */
  metadata?: {
    avatarUrl?: string;
    handle?: string;
    authors?: string[];
    subkind?: string;
    kind?: string;
    description?: string;
    isPersonal?: boolean;
  };
}

/**
 * A custom edge between two collection items.
 */
export interface CollectionEdgeFormData {
  /** AT-URI of the source item */
  sourceUri: string;
  /** AT-URI of the target item */
  targetUri: string;
  /** Relation type slug */
  relationSlug: string;
  /** Display label for the relation */
  relationLabel: string;
  /** Optional note */
  note?: string;
}

/**
 * A subcollection defined in the wizard.
 */
export interface SubcollectionFormData {
  /** Display name */
  name: string;
  /** URIs of items assigned to this subcollection */
  items: string[];
}

/**
 * Form values for the collection wizard.
 */
export interface CollectionFormValues {
  name: string;
  description?: string;
  visibility: 'public' | 'unlisted' | 'private';
  tags: string[];
  fields: FieldSelection[];
  items: CollectionItemFormData[];
  edges: CollectionEdgeFormData[];
  subcollections: SubcollectionFormData[];
  enableSembleMirror: boolean;
}

/**
 * Props for CollectionWizard component.
 */
export interface CollectionWizardProps {
  /** Callback when creation/update succeeds */
  onSuccess?: (collection: CollectionView) => void;
  /** Callback when user cancels */
  onCancel?: () => void;
  /** Pre-populated values for edit mode */
  initialValues?: Partial<CollectionFormValues>;
  /** Whether editing an existing collection */
  isEditMode?: boolean;
  /** URI of existing collection (edit mode) */
  existingUri?: string;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// SCHEMA
// =============================================================================

const collectionFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(300),
  description: z.string().max(3000).optional(),
  visibility: z.enum(['public', 'unlisted', 'private']),
  tags: z.array(z.string()).max(20).optional(),
  fields: z
    .array(z.object({ uri: z.string(), label: z.string(), description: z.string().optional() }))
    .optional(),
  items: z.array(
    z.object({
      uri: z.string(),
      type: z.string(),
      label: z.string(),
      note: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
  ),
  edges: z
    .array(
      z.object({
        sourceUri: z.string(),
        targetUri: z.string(),
        relationSlug: z.string(),
        relationLabel: z.string(),
        note: z.string().optional(),
      })
    )
    .optional(),
  subcollections: z
    .array(
      z.object({
        name: z.string().min(1),
        items: z.array(z.string()),
      })
    )
    .optional(),
  enableSembleMirror: z.boolean().default(false),
});

/**
 * Per-step validation schemas.
 */
const stepSchemas = {
  basics: z.object({
    name: z.string().min(1, 'Name is required').max(300),
    description: z.string().max(3000).optional(),
    visibility: z.enum(['public', 'unlisted', 'private']),
  }),
  items: z.object({}),
  edges: z.object({}),
  structure: z.object({}),
  semble: z.object({}),
  review: z.object({}),
};

// =============================================================================
// CONSTANTS
// =============================================================================

const WIZARD_STEPS: WizardStep[] = [
  { id: 'basics', title: 'Basics', description: 'Name & settings' },
  { id: 'items', title: 'Items', description: 'Add content' },
  { id: 'edges', title: 'Edges', description: 'Define relationships' },
  { id: 'structure', title: 'Structure', description: 'Organize items' },
  { id: 'semble', title: 'Semble', description: 'Optional integration' },
  { id: 'review', title: 'Review', description: 'Confirm & submit' },
];

/**
 * Item type display config.
 */
const ITEM_TYPE_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  eprint: { label: 'Eprint', icon: FileText, color: 'bg-blue-100 text-blue-800' },
  'at-uri': { label: 'AT-URI', icon: Link2, color: 'bg-purple-100 text-purple-800' },
  author: { label: 'Author', icon: User, color: 'bg-pink-100 text-pink-800' },
  graphNode: { label: 'Node', icon: Globe, color: 'bg-cyan-100 text-cyan-800' },
};

// =============================================================================
// STEP 1: BASICS
// =============================================================================

interface StepBasicsProps {
  form: ReturnType<typeof useForm<CollectionFormValues>>;
}

function StepBasics({ form }: StepBasicsProps) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;
  const tags = watch('tags') ?? [];
  const fields = watch('fields') ?? [];

  const handleTagSelect = useCallback(
    (tag: string) => {
      if (tags.length >= 20) return;
      if (!tags.includes(tag)) {
        setValue('tags', [...tags, tag], { shouldDirty: true });
      }
    },
    [tags, setValue]
  );

  const handleTagRemove = useCallback(
    (tag: string) => {
      setValue(
        'tags',
        tags.filter((t) => t !== tag),
        { shouldDirty: true }
      );
    },
    [tags, setValue]
  );

  const handleFieldAdd = useCallback(
    (field: FieldSelection) => {
      setValue('fields', [...fields, field], { shouldDirty: true });
    },
    [fields, setValue]
  );

  const handleFieldRemove = useCallback(
    (field: FieldSelection) => {
      setValue(
        'fields',
        fields.filter((f) => f.uri !== field.uri),
        { shouldDirty: true }
      );
    },
    [fields, setValue]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Collection Basics</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Name your collection and configure its visibility.
        </p>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="collection-name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="collection-name"
          {...register('name')}
          placeholder="e.g., Reading List: NLP Transformers"
          maxLength={300}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="collection-description">Description</Label>
        <Textarea
          id="collection-description"
          {...register('description')}
          placeholder="A brief description of this collection..."
          maxLength={3000}
          className="min-h-[100px]"
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* Visibility */}
      <div className="space-y-2">
        <Label htmlFor="collection-visibility">Visibility</Label>
        <Select
          value={watch('visibility')}
          onValueChange={(value) =>
            setValue('visibility', value as 'public' | 'unlisted' | 'private', {
              shouldDirty: true,
            })
          }
        >
          <SelectTrigger id="collection-visibility">
            <SelectValue placeholder="Select visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">Public (visible to everyone)</SelectItem>
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
              <Badge key={tag} variant="secondary" className="gap-1 py-1 pl-2 pr-1">
                <Hash className="h-3 w-3 text-muted-foreground" />
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => handleTagRemove(tag)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                  aria-label={`Remove tag ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        {tags.length < 20 && (
          <TagAutocomplete
            key={tags.length}
            onSelect={handleTagSelect}
            placeholder="Search tags..."
            existingTags={tags}
          />
        )}
        <p className="text-xs text-muted-foreground">{tags.length}/20 tags</p>
      </div>

      {/* Fields */}
      <FieldSearch
        selectedFields={fields}
        onFieldAdd={handleFieldAdd}
        onFieldRemove={handleFieldRemove}
        label="Fields"
        helpText="Categorize this collection by academic field."
      />
    </div>
  );
}

// =============================================================================
// STEP 2: ITEMS
// =============================================================================

interface StepItemsProps {
  form: ReturnType<typeof useForm<CollectionFormValues>>;
}

/**
 * Returns initials from a display name (up to 2 characters).
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

/**
 * Renders a single item in the items list with type badge, label, note, and remove.
 * Supports inline label editing and subkind-sensitive rendering.
 */
function CollectionItemRow({
  item,
  index,
  onNoteChange,
  onLabelChange,
  onRemove,
}: {
  item: CollectionItemFormData;
  index: number;
  onNoteChange: (index: number, note: string) => void;
  onLabelChange: (index: number, label: string) => void;
  onRemove: (index: number) => void;
}) {
  const [showNote, setShowNote] = useState(!!item.note);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabelValue, setEditLabelValue] = useState(item.label);
  const config = ITEM_TYPE_CONFIG[item.type] ?? {
    label: item.type,
    icon: FileText,
    color: 'bg-gray-100 text-gray-800',
  };
  const metadata = item.metadata;

  const confirmLabelEdit = useCallback(() => {
    const trimmed = editLabelValue.trim();
    if (trimmed && trimmed !== item.label) {
      onLabelChange(index, trimmed);
    }
    setIsEditingLabel(false);
  }, [editLabelValue, item.label, index, onLabelChange]);

  const cancelLabelEdit = useCallback(() => {
    setEditLabelValue(item.label);
    setIsEditingLabel(false);
  }, [item.label]);

  // Render the type-specific content area
  const renderItemContent = () => {
    if (item.type === 'author') {
      return (
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={metadata?.avatarUrl} alt={item.label} />
            <AvatarFallback>{getInitials(item.label)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            {isEditingLabel ? (
              <Input
                value={editLabelValue}
                onChange={(e) => setEditLabelValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmLabelEdit();
                  } else if (e.key === 'Escape') {
                    cancelLabelEdit();
                  }
                }}
                onBlur={confirmLabelEdit}
                className="h-7 text-sm"
                autoFocus
              />
            ) : (
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium truncate">{item.label}</p>
                <button
                  type="button"
                  onClick={() => {
                    setEditLabelValue(item.label);
                    setIsEditingLabel(true);
                  }}
                  className="text-muted-foreground hover:text-foreground p-0.5"
                  aria-label="Edit label"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
            {metadata?.handle && (
              <p className="text-xs text-muted-foreground truncate">@{metadata.handle}</p>
            )}
          </div>
        </div>
      );
    }

    if (item.type === 'eprint') {
      return (
        <div className="flex-1 min-w-0 space-y-1">
          {isEditingLabel ? (
            <Input
              value={editLabelValue}
              onChange={(e) => setEditLabelValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  confirmLabelEdit();
                } else if (e.key === 'Escape') {
                  cancelLabelEdit();
                }
              }}
              onBlur={confirmLabelEdit}
              className="h-7 text-sm"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-1">
              <p className="text-sm font-medium truncate">{item.label}</p>
              <button
                type="button"
                onClick={() => {
                  setEditLabelValue(item.label);
                  setIsEditingLabel(true);
                }}
                className="text-muted-foreground hover:text-foreground p-0.5"
                aria-label="Edit label"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
          {metadata?.authors && metadata.authors.length > 0 && (
            <p className="text-xs text-muted-foreground truncate">{metadata.authors.join(', ')}</p>
          )}
        </div>
      );
    }

    if (item.type === 'graphNode') {
      const subkindConfig = SUBKIND_BY_SLUG.get(metadata?.subkind ?? '');
      const NodeIcon = subkindConfig?.icon ?? Globe;

      return (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <NodeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            {isEditingLabel ? (
              <Input
                value={editLabelValue}
                onChange={(e) => setEditLabelValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmLabelEdit();
                  } else if (e.key === 'Escape') {
                    cancelLabelEdit();
                  }
                }}
                onBlur={confirmLabelEdit}
                className="h-7 text-sm"
                autoFocus
              />
            ) : (
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium truncate">{item.label}</p>
                <button
                  type="button"
                  onClick={() => {
                    setEditLabelValue(item.label);
                    setIsEditingLabel(true);
                  }}
                  className="text-muted-foreground hover:text-foreground p-0.5"
                  aria-label="Edit label"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-1 mt-0.5">
              {subkindConfig && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                  {subkindConfig.label}
                </Badge>
              )}
              {metadata?.isPersonal && (
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  Personal
                </Badge>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Default / AT-URI rendering
    return (
      <div className="flex-1 min-w-0 space-y-1">
        {isEditingLabel ? (
          <Input
            value={editLabelValue}
            onChange={(e) => setEditLabelValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmLabelEdit();
              } else if (e.key === 'Escape') {
                cancelLabelEdit();
              }
            }}
            onBlur={confirmLabelEdit}
            className="h-7 text-sm"
            autoFocus
          />
        ) : (
          <div className="flex items-center gap-1">
            <p className="text-sm font-medium truncate">{item.label}</p>
            <button
              type="button"
              onClick={() => {
                setEditLabelValue(item.label);
                setIsEditingLabel(true);
              }}
              className="text-muted-foreground hover:text-foreground p-0.5"
              aria-label="Edit label"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}
        <p className="text-xs text-muted-foreground truncate">{item.uri}</p>
      </div>
    );
  };

  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-3">
        <Badge variant="outline" className={cn('shrink-0 gap-1', config.color)}>
          <config.icon className="h-3 w-3" />
          {config.label}
        </Badge>
        <div className="flex-1 min-w-0 space-y-2">
          {renderItemContent()}
          <button
            type="button"
            onClick={() => setShowNote(!showNote)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {showNote ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showNote ? 'Hide note' : 'Add note'}
          </button>
          {showNote && (
            <Textarea
              value={item.note ?? ''}
              onChange={(e) => onNoteChange(index, e.target.value)}
              placeholder="Why is this item in the collection?"
              className="min-h-[60px] text-sm"
            />
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onRemove(index)}
          aria-label={`Remove ${item.label}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function StepItems({ form }: StepItemsProps) {
  const { setValue, watch } = form;
  const items = watch('items') ?? [];

  // Unified search state
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search hooks
  const eprintSearch = useInstantSearch(debouncedSearch);
  const authorSearch = useAuthorSearch(debouncedSearch, { limit: 5 });

  // Graph node search via direct fetch
  const [nodeResults, setNodeResults] = useState<
    Array<{
      uri: string;
      label: string;
      subkind?: string;
      kind?: string;
      description?: string;
      isPersonal?: boolean;
    }>
  >([]);

  useEffect(() => {
    if (debouncedSearch.length < 2) {
      setNodeResults([]);
      return;
    }
    const params = new URLSearchParams({
      query: debouncedSearch,
      limit: '5',
      status: 'established',
    });
    fetch(`/xrpc/pub.chive.graph.searchNodes?${params}`)
      .then((r) => (r.ok ? r.json() : { nodes: [] }))
      .then((data) => {
        setNodeResults(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((data as { nodes?: any[] }).nodes ?? []).map((n: any) => ({
            uri: n.uri as string,
            label: n.label as string,
            subkind: n.subkind as string | undefined,
            kind: n.kind as string | undefined,
            description: n.description as string | undefined,
            isPersonal: (n.isPersonal as boolean | undefined) ?? false,
          }))
        );
      })
      .catch(() => setNodeResults([]));
  }, [debouncedSearch]);

  // Click-outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Collapsible AT-URI section
  const [showAtUriInput, setShowAtUriInput] = useState(false);

  const eprintHits = (eprintSearch.data?.hits ?? []) as unknown as EnrichedSearchHit[];
  const authorHits = authorSearch.data?.authors ?? [];
  const isSearching = eprintSearch.isLoading || authorSearch.isLoading;
  const hasResults = eprintHits.length > 0 || authorHits.length > 0 || nodeResults.length > 0;

  const addItem = useCallback(
    (item: CollectionItemFormData) => {
      if (items.some((existing) => existing.uri === item.uri)) {
        toast.info('This item is already in the collection.');
        return;
      }
      setValue('items', [...items, item], { shouldDirty: true });
    },
    [items, setValue]
  );

  const removeItem = useCallback(
    (index: number) => {
      const updated = [...items];
      updated.splice(index, 1);
      setValue('items', updated, { shouldDirty: true });
    },
    [items, setValue]
  );

  const updateNote = useCallback(
    (index: number, note: string) => {
      const updated = [...items];
      updated[index] = { ...updated[index], note };
      setValue('items', updated, { shouldDirty: true });
    },
    [items, setValue]
  );

  const updateLabel = useCallback(
    (index: number, label: string) => {
      const updated = [...items];
      updated[index] = { ...updated[index], label };
      setValue('items', updated, { shouldDirty: true });
    },
    [items, setValue]
  );

  // AT-URI manual input
  const [atUriInput, setAtUriInput] = useState('');

  const handleAddAtUri = useCallback(() => {
    const trimmed = atUriInput.trim();
    if (!trimmed.startsWith('at://')) {
      toast.error('AT-URI must start with at://');
      return;
    }
    addItem({ uri: trimmed, type: 'at-uri', label: trimmed });
    setAtUriInput('');
  }, [atUriInput, addItem]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Add Items</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add eprints, authors, or graph nodes to your collection.
        </p>
      </div>

      {/* Unified search */}
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => {
              if (searchQuery.length >= 2) setShowDropdown(true);
            }}
            placeholder="Search eprints, authors, or graph nodes..."
            className="pl-9"
          />
        </div>

        {/* Search results dropdown */}
        {showDropdown && searchQuery.length >= 2 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-[400px] overflow-y-auto">
            {/* Loading state */}
            {isSearching && !hasResults && (
              <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </div>
            )}

            {/* No results */}
            {!isSearching && !hasResults && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No results found for &quot;{searchQuery}&quot;
              </div>
            )}

            {/* Eprint results */}
            {eprintHits.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                  <FileText className="h-3 w-3" />
                  Eprints
                </div>
                {eprintHits.slice(0, 5).map((hit) => (
                  <button
                    key={hit.uri}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                    onClick={() => {
                      addItem({
                        uri: hit.uri,
                        type: 'eprint',
                        label: hit.title ?? 'Untitled',
                        metadata: {
                          authors: hit.authors?.map((a) => a.name ?? 'Unknown'),
                        },
                      });
                      setSearchQuery('');
                      setShowDropdown(false);
                    }}
                  >
                    <p className="text-sm font-medium truncate">{hit.title ?? 'Untitled'}</p>
                    {hit.authors && hit.authors.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate">
                        {hit.authors.map((a) => a.name ?? 'Unknown').join(', ')}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Author results */}
            {authorHits.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                  <User className="h-3 w-3" />
                  Authors
                </div>
                {authorHits.slice(0, 5).map((author: AuthorSearchResult) => (
                  <button
                    key={author.did}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center gap-2"
                    onClick={() => {
                      addItem({
                        uri: author.did,
                        type: 'author',
                        label: author.displayName ?? author.handle ?? author.did,
                        metadata: {
                          avatarUrl: author.avatar,
                          handle: author.handle,
                        },
                      });
                      setSearchQuery('');
                      setShowDropdown(false);
                    }}
                  >
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarImage src={author.avatar} alt={author.displayName ?? author.handle} />
                      <AvatarFallback className="text-[10px]">
                        {getInitials(author.displayName ?? author.handle ?? '?')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {author.displayName ?? author.handle ?? author.did}
                      </p>
                      {author.handle && (
                        <p className="text-xs text-muted-foreground truncate">@{author.handle}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Graph node results */}
            {nodeResults.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                  <Globe className="h-3 w-3" />
                  Graph Nodes
                </div>
                {nodeResults.slice(0, 5).map((node) => {
                  const subkindConfig = SUBKIND_BY_SLUG.get(node.subkind ?? '');
                  const NodeIcon = subkindConfig?.icon ?? Globe;

                  return (
                    <button
                      key={node.uri}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center gap-2"
                      onClick={() => {
                        addItem({
                          uri: node.uri,
                          type: 'graphNode',
                          label: node.label,
                          metadata: {
                            subkind: node.subkind,
                            kind: node.kind,
                            description: node.description,
                            isPersonal: node.isPersonal,
                          },
                        });
                        setSearchQuery('');
                        setShowDropdown(false);
                      }}
                    >
                      <NodeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm truncate">{node.label}</span>
                      {subkindConfig && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">
                          {subkindConfig.label}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Collapsible AT-URI input */}
      <div>
        <button
          type="button"
          onClick={() => setShowAtUriInput(!showAtUriInput)}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          {showAtUriInput ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Add by AT-URI
        </button>
        {showAtUriInput && (
          <div className="flex gap-2 mt-2">
            <Input
              value={atUriInput}
              onChange={(e) => setAtUriInput(e.target.value)}
              placeholder="at://did:plc:abc/pub.chive.eprint.submission/123"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddAtUri();
                }
              }}
            />
            <Button
              type="button"
              onClick={handleAddAtUri}
              disabled={!atUriInput.trim().startsWith('at://')}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        )}
      </div>

      {/* Item list */}
      {items.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Items ({items.length})</h3>
          {items.map((item, index) => (
            <CollectionItemRow
              key={`${item.uri}-${index}`}
              item={item}
              index={index}
              onNoteChange={updateNote}
              onLabelChange={updateLabel}
              onRemove={removeItem}
            />
          ))}
        </div>
      )}

      {items.length === 0 && (
        <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
          <p>No items added yet. Use the search above to find and add items.</p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// STEP 3: CUSTOM EDGES
// =============================================================================

interface StepEdgesProps {
  form: ReturnType<typeof useForm<CollectionFormValues>>;
}

function StepEdges({ form }: StepEdgesProps) {
  const { setValue, watch } = form;
  const items = watch('items') ?? [];
  const edges = watch('edges') ?? [];

  const [sourceUri, setSourceUri] = useState('');
  const [targetUri, setTargetUri] = useState('');
  const [selectedRelation, setSelectedRelation] = useState<NodeSuggestion | null>(null);
  const [edgeNote, setEdgeNote] = useState('');

  const createPersonalNode = useCreatePersonalNode();

  const addEdge = useCallback(() => {
    if (!sourceUri || !targetUri || !selectedRelation) {
      toast.error('Select source, target, and relation type.');
      return;
    }
    if (sourceUri === targetUri) {
      toast.error('Source and target must be different items.');
      return;
    }

    const newEdge: CollectionEdgeFormData = {
      sourceUri,
      targetUri,
      relationSlug: selectedRelation.label.toLowerCase().replace(/\s+/g, '-'),
      relationLabel: selectedRelation.label,
      note: edgeNote || undefined,
    };

    setValue('edges', [...edges, newEdge], { shouldDirty: true });
    setSourceUri('');
    setTargetUri('');
    setSelectedRelation(null);
    setEdgeNote('');
  }, [sourceUri, targetUri, selectedRelation, edgeNote, edges, setValue]);

  const removeEdge = useCallback(
    (index: number) => {
      const updated = [...edges];
      updated.splice(index, 1);
      setValue('edges', updated, { shouldDirty: true });
    },
    [edges, setValue]
  );

  const getItemLabel = useCallback(
    (uri: string): string => {
      return items.find((i) => i.uri === uri)?.label ?? uri;
    },
    [items]
  );

  const handleCreateNewRelation = useCallback(
    async (label: string) => {
      try {
        const result = await createPersonalNode.mutateAsync({
          kind: 'type',
          subkind: 'relation',
          label,
        });
        setSelectedRelation({
          id: result.uri,
          uri: result.uri,
          label: result.label,
          kind: 'type',
          subkind: 'relation',
          status: 'established',
          isPersonal: true,
        });
        toast.success(`Created relation type: ${label}`);
      } catch {
        toast.error('Failed to create relation type.');
      }
    },
    [createPersonalNode]
  );

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
          </div>

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
          {edges.map((edge, index) => (
            <Card key={index}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm flex items-center flex-wrap gap-y-1">
                    <span className="font-medium">{getItemLabel(edge.sourceUri)}</span>
                    <span className="mx-2 text-muted-foreground">&rarr;</span>
                    <Badge variant="outline" className="mx-1">
                      {edge.relationLabel}
                    </Badge>
                    <span className="mx-2 text-muted-foreground">&rarr;</span>
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
          ))}
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

// =============================================================================
// STEP 4: STRUCTURE
// =============================================================================

interface StepStructureProps {
  form: ReturnType<typeof useForm<CollectionFormValues>>;
}

function StepStructure({ form }: StepStructureProps) {
  const { setValue, watch } = form;
  const items = watch('items') ?? [];
  const subcollections = watch('subcollections') ?? [];

  const [newSubName, setNewSubName] = useState('');

  const addSubcollection = useCallback(() => {
    const trimmed = newSubName.trim();
    if (!trimmed) return;
    if (subcollections.some((s) => s.name === trimmed)) {
      toast.error('A subcollection with this name already exists.');
      return;
    }
    setValue('subcollections', [...subcollections, { name: trimmed, items: [] }], {
      shouldDirty: true,
    });
    setNewSubName('');
  }, [newSubName, subcollections, setValue]);

  const removeSubcollection = useCallback(
    (index: number) => {
      const updated = [...subcollections];
      updated.splice(index, 1);
      setValue('subcollections', updated, { shouldDirty: true });
    },
    [subcollections, setValue]
  );

  const assignItemToSubcollection = useCallback(
    (itemUri: string, subIndex: number | 'none') => {
      // Remove from all subcollections first
      const updated = subcollections.map((sub) => ({
        ...sub,
        items: sub.items.filter((uri) => uri !== itemUri),
      }));
      // Add to selected subcollection
      if (subIndex !== 'none' && typeof subIndex === 'number') {
        updated[subIndex] = {
          ...updated[subIndex],
          items: [...updated[subIndex].items, itemUri],
        };
      }
      setValue('subcollections', updated, { shouldDirty: true });
    },
    [subcollections, setValue]
  );

  const moveItem = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= items.length) return;
      const updated = [...items];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      setValue('items', updated, { shouldDirty: true });
    },
    [items, setValue]
  );

  const getSubcollectionForItem = useCallback(
    (itemUri: string): number | 'none' => {
      const idx = subcollections.findIndex((sub) => sub.items.includes(itemUri));
      return idx >= 0 ? idx : 'none';
    },
    [subcollections]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Structure</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create subcollections, reorder items, and assign items to subcollections.
        </p>
      </div>

      {/* Create subcollection */}
      <div className="space-y-2">
        <Label>Subcollections</Label>
        <div className="flex gap-2">
          <Input
            value={newSubName}
            onChange={(e) => setNewSubName(e.target.value)}
            placeholder="Subcollection name..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSubcollection();
              }
            }}
          />
          <Button type="button" onClick={addSubcollection} disabled={!newSubName.trim()}>
            <FolderPlus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
        {subcollections.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {subcollections.map((sub, index) => (
              <Badge key={sub.name} variant="secondary" className="gap-1 py-1 pl-2 pr-1">
                <FolderPlus className="h-3 w-3 text-muted-foreground" />
                <span>{sub.name}</span>
                <span className="text-[10px] text-muted-foreground ml-1">({sub.items.length})</span>
                <button
                  type="button"
                  onClick={() => removeSubcollection(index)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                  aria-label={`Remove ${sub.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Item ordering and subcollection assignment */}
      <div className="space-y-2">
        <Label>Item Order &amp; Assignment</Label>
        {items.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
            <p>No items to organize. Add items in the previous step.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, index) => {
              const config = ITEM_TYPE_CONFIG[item.type] ?? {
                label: item.type,
                icon: FileText,
                color: 'bg-gray-100 text-gray-800',
              };
              const Icon = config.icon;

              return (
                <Card key={`${item.uri}-${index}`}>
                  <CardContent className="flex items-center gap-3 p-3">
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveItem(index, index - 1)}
                        disabled={index === 0}
                        className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        aria-label="Move up"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <button
                        type="button"
                        onClick={() => moveItem(index, index + 1)}
                        disabled={index === items.length - 1}
                        className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        aria-label="Move down"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Item info */}
                    <Badge variant="outline" className={cn('shrink-0 gap-1', config.color)}>
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                    <span className="text-sm font-medium truncate flex-1 min-w-0">
                      {item.label}
                    </span>

                    {/* Subcollection assignment */}
                    {subcollections.length > 0 && (
                      <Select
                        value={String(getSubcollectionForItem(item.uri))}
                        onValueChange={(val) => {
                          assignItemToSubcollection(
                            item.uri,
                            val === 'none' ? 'none' : Number(val)
                          );
                        }}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="No subcollection" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No subcollection</SelectItem>
                          {subcollections.map((sub, subIdx) => (
                            <SelectItem key={sub.name} value={String(subIdx)}>
                              {sub.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// STEP 5: SEMBLE
// =============================================================================

interface StepSembleProps {
  form: ReturnType<typeof useForm<CollectionFormValues>>;
}

function StepSemble({ form }: StepSembleProps) {
  const { setValue, watch } = form;
  const enableSembleMirror = watch('enableSembleMirror');
  const name = watch('name');
  const description = watch('description');
  const visibility = watch('visibility');
  const items = watch('items') ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Semble Integration</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Optionally mirror this collection on Semble for broader discovery.
        </p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="semble-mirror"
              checked={enableSembleMirror}
              onCheckedChange={(checked) => {
                setValue('enableSembleMirror', !!checked, { shouldDirty: true });
              }}
            />
            <div className="space-y-1">
              <Label htmlFor="semble-mirror" className="cursor-pointer">
                Mirror this collection on Semble
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, a Semble reading list will be created with the same items. Changes to
                this collection will be synced.
              </p>
            </div>
          </div>

          {enableSembleMirror && (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <h4 className="text-sm font-medium">Semble Mirror Preview</h4>

                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Collection title:</span>{' '}
                    <span className="font-medium">{name || 'Untitled'}</span>
                  </div>
                  {description && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Description:</span>{' '}
                      <span>{description}</span>
                    </div>
                  )}
                  <div className="text-sm">
                    <span className="text-muted-foreground">Visibility:</span>{' '}
                    <Badge variant="outline" className="capitalize text-xs">
                      {visibility}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Semble cards to create:</span>{' '}
                    <span className="font-medium">
                      {items.length} card{items.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {items.length > 0 ? (
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {items.map((item, index) => {
                        const config = ITEM_TYPE_CONFIG[item.type] ?? {
                          label: item.type,
                          icon: FileText,
                          color: 'bg-gray-100 text-gray-800',
                        };
                        const Icon = config.icon;

                        return (
                          <div
                            key={`${item.uri}-${index}`}
                            className="flex items-center gap-2 text-xs py-1"
                          >
                            <Badge
                              variant="outline"
                              className={cn('shrink-0 gap-0.5 text-[10px] px-1', config.color)}
                            >
                              <Icon className="h-2.5 w-2.5" />
                              {config.label}
                            </Badge>
                            <span className="truncate">{item.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No items to mirror. Add items in the Items step first.
                    </p>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Items will be mirrored as{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[10px]">xyz.semble.card</code>{' '}
                records and grouped into an{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                  xyz.semble.collection
                </code>{' '}
                in your PDS.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// STEP 6: REVIEW
// =============================================================================

interface StepReviewProps {
  form: ReturnType<typeof useForm<CollectionFormValues>>;
  isSubmitting: boolean;
  submitError: string | null;
}

function StepReview({ form, isSubmitting, submitError }: StepReviewProps) {
  const values = form.getValues();
  const items = values.items ?? [];
  const edges = values.edges ?? [];
  const subcollections = values.subcollections ?? [];
  const fields = values.fields ?? [];
  const tags = values.tags ?? [];

  const getItemLabel = useCallback(
    (uri: string): string => items.find((i) => i.uri === uri)?.label ?? uri,
    [items]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Review Collection</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the details before creating your collection.
        </p>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="space-y-4 pt-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Name</h3>
            <p className="font-medium">{values.name}</p>
          </div>

          {values.description && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
              <p className="text-sm whitespace-pre-wrap">{values.description}</p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Visibility</h3>
            <Badge variant="outline" className="capitalize">
              {values.visibility}
            </Badge>
          </div>

          {tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Tags</h3>
              <div className="flex flex-wrap gap-1 mt-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {fields.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Fields</h3>
              <div className="flex flex-wrap gap-1 mt-1">
                {fields.map((f) => (
                  <Badge key={f.uri} variant="secondary">
                    {f.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <div>
        <h3 className="text-sm font-medium mb-2">Items ({items.length})</h3>
        {items.length > 0 ? (
          <div className="space-y-1">
            {items.map((item, index) => {
              const config = ITEM_TYPE_CONFIG[item.type] ?? {
                label: item.type,
                icon: FileText,
                color: 'bg-gray-100 text-gray-800',
              };
              const Icon = config.icon;

              return (
                <div key={`${item.uri}-${index}`} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className={cn('shrink-0 gap-1 text-xs', config.color)}>
                    <Icon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                  <span className="truncate">{item.label}</span>
                  {item.note && (
                    <span className="text-xs text-muted-foreground truncate">({item.note})</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No items added.</p>
        )}
      </div>

      {/* Subcollections */}
      {subcollections.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Subcollections ({subcollections.length})</h3>
          <div className="space-y-1">
            {subcollections.map((sub) => (
              <div key={sub.name} className="flex items-center gap-2 text-sm">
                <FolderPlus className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{sub.name}</span>
                <span className="text-muted-foreground">
                  ({sub.items.length} item{sub.items.length !== 1 ? 's' : ''})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edges */}
      {edges.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Custom Edges ({edges.length})</h3>
          <div className="space-y-1">
            {edges.map((edge, index) => (
              <div key={index} className="text-sm">
                <span className="font-medium">{getItemLabel(edge.sourceUri)}</span>
                <span className="mx-2 text-muted-foreground">&rarr;</span>
                <Badge variant="outline" className="text-xs mx-1">
                  {edge.relationLabel}
                </Badge>
                <span className="mx-2 text-muted-foreground">&rarr;</span>
                <span className="font-medium">{getItemLabel(edge.targetUri)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Semble */}
      {values.enableSembleMirror && <Badge variant="secondary">Semble mirror enabled</Badge>}

      {/* Submit error */}
      {submitError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{submitError}</p>
        </div>
      )}

      {isSubmitting && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Creating collection and adding items...
        </div>
      )}
    </div>
  );
}

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
      visibility: initialValues?.visibility ?? 'public',
      tags: initialValues?.tags ?? [],
      fields: initialValues?.fields ?? [],
      items: initialValues?.items ?? [],
      edges: initialValues?.edges ?? [],
      subcollections: initialValues?.subcollections ?? [],
      enableSembleMirror: initialValues?.enableSembleMirror ?? false,
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

      // 1. Create the collection node (with Semble mirror items if enabled)
      const collection = await createCollection.mutateAsync({
        name: values.name,
        description: values.description,
        visibility: values.visibility,
        tags: values.tags.length > 0 ? values.tags : undefined,
        enableSembleMirror: values.enableSembleMirror || undefined,
        items:
          values.enableSembleMirror && values.items.length > 0
            ? values.items.map((item) => ({
                uri: item.uri,
                label: item.label,
                note: item.note,
              }))
            : undefined,
      });

      wizardLogger.info('Collection node created', { uri: collection.uri });

      // 2. Create personal graph nodes for all items, building a URI mapping
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
            // Community graph node: clone into personal graph
            nodeInput = {
              kind: item.metadata?.kind ?? 'object',
              subkind: item.metadata?.subkind ?? 'concept',
              label: item.label,
              description: item.metadata?.description,
              metadata: { clonedFrom: item.uri },
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

      // 3. Add each item to the collection via CONTAINS edge using personal node URIs
      const itemResults: Array<{ itemUri: string; edgeUri: string }> = [];
      for (let i = 0; i < values.items.length; i++) {
        const item = values.items[i];
        const personalNodeUri = uriMap.get(item.uri) ?? item.uri;
        try {
          const result = await addToCollection.mutateAsync({
            collectionUri: collection.uri,
            itemUri: personalNodeUri,
            label: item.label,
            note: item.note,
            order: i,
          });
          itemResults.push({ itemUri: personalNodeUri, edgeUri: result.edgeUri });
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
          // Create child collection node
          const childCollection = await createCollection.mutateAsync({
            name: sub.name,
            visibility: values.visibility,
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

      // 5. Create custom edges using remapped URIs
      const ownerDid = (agent as unknown as { did?: string }).did ?? '';
      for (const edge of values.edges ?? []) {
        try {
          await createPersonalEdge.mutateAsync({
            sourceUri: uriMap.get(edge.sourceUri) ?? edge.sourceUri,
            targetUri: uriMap.get(edge.targetUri) ?? edge.targetUri,
            relationSlug: edge.relationSlug,
            metadata: edge.note ? { note: edge.note } : undefined,
            ownerDid,
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
        return <StepSemble form={form} />;
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
