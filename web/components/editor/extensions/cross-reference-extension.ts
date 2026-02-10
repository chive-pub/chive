/**
 * TipTap extension for [[ cross-reference autocomplete.
 *
 * @remarks
 * Allows users to type [[ to reference reviews and annotations within the
 * current eprint. Inserts an inline crossReference node that renders as a
 * clickable badge. Uses @tiptap/suggestion for the autocomplete popup.
 *
 * @packageDocumentation
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';

import type { CrossReferenceItem } from '../cross-reference-list';

// =============================================================================
// TYPES
// =============================================================================

export interface CrossReferenceOptions {
  /** Custom HTML attributes for the node */
  HTMLAttributes: Record<string, unknown>;
  /** Suggestion configuration (items, render, etc.) */
  suggestion: Omit<SuggestionOptions<CrossReferenceItem, CrossReferenceItem>, 'editor'>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    crossReference: {
      /** Insert a cross-reference node */
      setCrossReference: (attrs: {
        uri: string;
        label: string;
        refType: 'review' | 'annotation';
      }) => ReturnType;
    };
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CROSS_REFERENCE_PLUGIN_KEY = new PluginKey('crossReference');

// =============================================================================
// EXTENSION
// =============================================================================

/**
 * TipTap extension for cross-referencing reviews and annotations.
 *
 * @example
 * ```typescript
 * import { CrossReferenceExtension } from './extensions/cross-reference-extension';
 *
 * const editor = useEditor({
 *   extensions: [
 *     StarterKit,
 *     CrossReferenceExtension.configure({
 *       suggestion: {
 *         items: async ({ query }) => fetchCrossReferences(query),
 *         render: () => createCrossReferenceRenderer(),
 *       },
 *     }),
 *   ],
 * });
 * ```
 */
export const CrossReferenceExtension = Node.create<CrossReferenceOptions>({
  name: 'crossReference',

  group: 'inline',

  inline: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      suggestion: {
        char: '[[',
        pluginKey: CROSS_REFERENCE_PLUGIN_KEY,
        allowSpaces: true,
        command: ({ editor, range, props }) => {
          // Delete the trigger text and insert the cross-reference node
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: 'crossReference',
              attrs: {
                uri: props.uri,
                label: props.label,
                refType: props.type,
              },
            })
            .insertContent(' ')
            .run();
        },
      },
    };
  },

  addAttributes() {
    return {
      uri: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-uri') || '',
        renderHTML: (attributes) => ({
          'data-uri': attributes.uri as string,
        }),
      },
      label: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-label') || '',
        renderHTML: (attributes) => ({
          'data-label': attributes.label as string,
        }),
      },
      refType: {
        default: 'review',
        parseHTML: (element) => element.getAttribute('data-ref-type') || 'review',
        renderHTML: (attributes) => ({
          'data-ref-type': attributes.refType as string,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-cross-reference]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const refType = node.attrs.refType as string;
    const label = node.attrs.label as string;

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-cross-reference': '',
        class: `cross-reference cross-reference-${refType}`,
        contenteditable: 'false',
      }),
      label,
    ];
  },

  addCommands() {
    return {
      setCrossReference:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export { CROSS_REFERENCE_PLUGIN_KEY };
