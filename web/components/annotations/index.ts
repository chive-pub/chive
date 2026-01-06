/**
 * Annotation components for the FOVEA-style glossing system.
 *
 * Provides:
 * - Rich text editing with embedded knowledge graph references
 * - Entity search (Wikidata, Chive authorities)
 * - Entity linking dialogs for text spans
 *
 * @example
 * ```tsx
 * import {
 *   AnnotationEditor,
 *   EntityLinkDialog,
 *   WikidataSearch,
 * } from '@/components/annotations';
 *
 * // FOVEA-style editor
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
// ENTITY SEARCH
// =============================================================================

export { WikidataSearch, type WikidataEntity, type WikidataSearchProps } from './wikidata-search';

export {
  AuthoritySearch,
  type AuthorityResult,
  type AuthoritySearchProps,
} from './authority-search';

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
