/**
 * Annotation components for the FOVEA-style glossing system.
 *
 * Provides:
 * - Rich text editing with embedded knowledge graph references
 * - @ trigger for object nodes (institutions, persons, topics, etc.)
 * - # trigger for type nodes (fields, facets, contribution-types, etc.)
 * - Entity search (Wikidata, knowledge graph nodes)
 * - Entity linking dialogs for text spans
 *
 * @example
 * ```tsx
 * import {
 *   AnnotationEditor,
 *   EntityLinkDialog,
 *   WikidataSearch,
 *   NodeMentionAutocomplete,
 * } from '@/components/annotations';
 *
 * // FOVEA-style editor with @ and # triggers
 * <AnnotationEditor value={body} onChange={setBody} />
 *
 * // Entity linking
 * <EntityLinkDialog
 *   open={isOpen}
 *   selectedText="neural networks"
 *   onLink={handleLink}
 * />
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// ANNOTATION EDITOR
// =============================================================================

export {
  AnnotationEditor,
  AnnotationPreview,
  type AnnotationEditorProps,
} from './annotation-editor';

// =============================================================================
// NODE MENTION AUTOCOMPLETE
// =============================================================================

export {
  NodeMentionAutocomplete,
  type NodeMentionAutocompleteProps,
} from './node-mention-autocomplete';

// =============================================================================
// ENTITY SEARCH
// =============================================================================

export { WikidataSearch, type WikidataEntity, type WikidataSearchProps } from './wikidata-search';

// Node search is exported from knowledge-graph module
// import { NodeSearch } from '@/components/knowledge-graph';

// =============================================================================
// ENTITY LINK DIALOG
// =============================================================================

export { EntityLinkDialog, type EntityLinkDialogProps } from './entity-link-dialog';

// =============================================================================
// ANNOTATION SIDEBAR
// =============================================================================

export {
  AnnotationSidebar,
  AnnotationSidebarSkeleton,
  type AnnotationSidebarProps,
} from './annotation-sidebar';
