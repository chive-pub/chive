/**
 * TipTap extension for LaTeX math rendering.
 *
 * @remarks
 * Supports both inline math ($...$) and display math ($$...$$).
 * Uses KaTeX for fast, high-quality math rendering.
 *
 * @packageDocumentation
 */

import { Node, mergeAttributes, nodeInputRule } from '@tiptap/core';
import katex from 'katex';

// =============================================================================
// TYPES
// =============================================================================

export interface LatexOptions {
  /** Custom HTML attributes for the node */
  HTMLAttributes: Record<string, unknown>;
  /** KaTeX rendering options */
  katexOptions: katex.KatexOptions;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    latex: {
      /** Insert a LaTeX expression */
      setLatex: (options: { latex: string; displayMode: boolean }) => ReturnType;
    };
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Input rule for inline math: type $latex$ */
const INLINE_INPUT_REGEX = /(?:^|\s)\$([^$]+)\$$/;

/** Input rule for display math: type $$latex$$ */
const DISPLAY_INPUT_REGEX = /\$\$([^$]+)\$\$$/;

// =============================================================================
// UTILITY
// =============================================================================

/**
 * Render LaTeX to HTML using KaTeX.
 *
 * @param latex - LaTeX expression
 * @param displayMode - Whether to render in display mode
 * @param options - Additional KaTeX options
 * @returns Rendered HTML string
 */
function renderLatex(
  latex: string,
  displayMode: boolean,
  options: katex.KatexOptions = {}
): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      errorColor: '#cc0000',
      ...options,
    });
  } catch (error) {
    // Return error display for invalid LaTeX
    return `<span class="latex-error" title="${error instanceof Error ? error.message : 'Invalid LaTeX'}">${latex}</span>`;
  }
}

// =============================================================================
// EXTENSION
// =============================================================================

/**
 * TipTap extension for LaTeX math expressions.
 *
 * @example
 * ```typescript
 * import { LatexExtension } from './latex-extension';
 *
 * const editor = useEditor({
 *   extensions: [
 *     StarterKit,
 *     LatexExtension,
 *   ],
 * });
 * ```
 */
export const LatexExtension = Node.create<LatexOptions>({
  name: 'latex',

  group: 'inline',

  inline: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      katexOptions: {
        throwOnError: false,
        errorColor: '#cc0000',
      },
    };
  },

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-latex') || '',
        renderHTML: (attributes) => ({
          'data-latex': attributes.latex as string,
        }),
      },
      displayMode: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-display-mode') === 'true',
        renderHTML: (attributes) => ({
          'data-display-mode': String(attributes.displayMode),
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-latex]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const displayMode = node.attrs.displayMode as boolean;

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: displayMode ? 'latex-display' : 'latex-inline',
        contenteditable: 'false',
      }),
      ['span', { class: 'latex-rendered' }],
    ];
  },

  addCommands() {
    return {
      setLatex:
        ({ latex, displayMode }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { latex, displayMode },
          });
        },
    };
  },

  addInputRules() {
    return [
      // Inline math: $latex$
      nodeInputRule({
        find: INLINE_INPUT_REGEX,
        type: this.type,
        getAttributes: (match) => ({
          latex: match[1],
          displayMode: false,
        }),
      }),
      // Display math: $$latex$$
      nodeInputRule({
        find: DISPLAY_INPUT_REGEX,
        type: this.type,
        getAttributes: (match) => ({
          latex: match[1],
          displayMode: true,
        }),
      }),
    ];
  },

  addNodeView() {
    return ({ node, HTMLAttributes }) => {
      const latex = node.attrs.latex as string;
      const displayMode = node.attrs.displayMode as boolean;

      const dom = document.createElement('span');
      dom.className = displayMode ? 'latex-display' : 'latex-inline';
      dom.contentEditable = 'false';
      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        dom.setAttribute(key, String(value));
      });

      // Render the LaTeX content
      dom.innerHTML = renderLatex(latex, displayMode, this.options.katexOptions);

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) {
            return false;
          }
          const newLatex = updatedNode.attrs.latex as string;
          const newDisplayMode = updatedNode.attrs.displayMode as boolean;
          dom.className = newDisplayMode ? 'latex-display' : 'latex-inline';
          dom.innerHTML = renderLatex(newLatex, newDisplayMode, this.options.katexOptions);
          return true;
        },
      };
    };
  },
});

export default LatexExtension;
