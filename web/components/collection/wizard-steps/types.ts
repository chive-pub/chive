/**
 * Shared types, schema, and constants for the collection wizard.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import { FileText, Link2, User, Globe, MessageSquare, Award } from 'lucide-react';

import type { FieldSelection } from '@/components/forms/field-search';
import type { WizardStep } from '../../submit/wizard-progress';

// =============================================================================
// FORM DATA TYPES
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
    [key: string]: string | string[] | boolean | undefined;
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
  /** Whether this edge is part of a bidirectional pair */
  isBidirectional?: boolean;
  /** Slug of the inverse relation (for paired edges) */
  inverseRelationSlug?: string;
  /** Display label for the inverse relation */
  inverseRelationLabel?: string;
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
  visibility: 'listed' | 'unlisted';
  tags: string[];
  fields: FieldSelection[];
  items: CollectionItemFormData[];
  edges: CollectionEdgeFormData[];
  subcollections: SubcollectionFormData[];
  enableCosmikMirror: boolean;
  /** Collaborator DIDs for shared Cosmik collections */
  cosmikCollaborators: string[];
  /** Whether to sync edges as Cosmik connections */
  syncEdgesAsConnections: boolean;
}

// =============================================================================
// WIZARD PROPS
// =============================================================================

/**
 * Props for CollectionWizard component.
 */
export interface CollectionWizardProps {
  /** Callback when creation/update succeeds */
  onSuccess?: (collection: import('@/lib/hooks/use-collections').CollectionView) => void;
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

export const collectionFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(300),
  description: z.string().max(3000).optional(),
  visibility: z.enum(['listed', 'unlisted']),
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
        isBidirectional: z.boolean().optional(),
        inverseRelationSlug: z.string().optional(),
        inverseRelationLabel: z.string().optional(),
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
  enableCosmikMirror: z.boolean().default(false),
  cosmikCollaborators: z.array(z.string()).default([]),
  syncEdgesAsConnections: z.boolean().default(true),
});

/**
 * Per-step validation schemas.
 */
export const stepSchemas = {
  basics: z.object({
    name: z.string().min(1, 'Name is required').max(300),
    description: z.string().max(3000).optional(),
    visibility: z.enum(['listed', 'unlisted']),
  }),
  items: z.object({}),
  edges: z.object({}),
  structure: z.object({}),
  cosmik: z.object({}),
  review: z.object({}),
};

// =============================================================================
// CONSTANTS
// =============================================================================

export const WIZARD_STEPS: WizardStep[] = [
  { id: 'basics', title: 'Basics', description: 'Name & settings' },
  { id: 'items', title: 'Items', description: 'Add content' },
  { id: 'edges', title: 'Edges', description: 'Define relationships' },
  { id: 'structure', title: 'Structure', description: 'Organize items' },
  { id: 'cosmik', title: 'Semble', description: 'Optional integration' },
  { id: 'review', title: 'Review', description: 'Confirm & submit' },
];

/**
 * Item type display config.
 */
export const ITEM_TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof FileText; color: string }
> = {
  eprint: { label: 'Eprint', icon: FileText, color: 'bg-blue-100 text-blue-800' },
  'at-uri': { label: 'AT-URI', icon: Link2, color: 'bg-purple-100 text-purple-800' },
  author: { label: 'Author', icon: User, color: 'bg-pink-100 text-pink-800' },
  graphNode: { label: 'Node', icon: Globe, color: 'bg-cyan-100 text-cyan-800' },
  review: { label: 'Review', icon: MessageSquare, color: 'bg-amber-100 text-amber-800' },
  endorsement: { label: 'Endorsement', icon: Award, color: 'bg-green-100 text-green-800' },
};
