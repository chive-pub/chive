'use client';

/**
 * Markdown editor with preview support.
 *
 * @remarks
 * A plaintext editor where users write markdown syntax directly.
 * Features:
 * - Toolbar buttons insert markdown syntax (not WYSIWYG)
 * - Preview mode renders markdown with LaTeX support
 * - Autocomplete for @ mentions and # tags
 * - Character count with optional limit
 *
 * @example
 * ```tsx
 * <MarkdownEditor
 *   value={content}
 *   onChange={setContent}
 *   placeholder="Write your abstract using Markdown..."
 *   enablePreview
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent, ReactRenderer, Editor } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import History from '@tiptap/extension-history';
import Placeholder from '@tiptap/extension-placeholder';
import Mention, { type MentionOptions } from '@tiptap/extension-mention';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  SquareCode,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Link as LinkIcon,
  Eye,
  Edit3,
  Sigma,
  Hash,
  AtSign,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/observability';
import { api } from '@/lib/api/client';
import type { SuggestionItem } from './suggestion-list';
import { MentionList, TagList } from './suggestion-list';
import { MarkdownPreviewPane } from './markdown-preview-pane';

const editorLogger = logger.child({ component: 'markdown-editor' });

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for MarkdownEditor component.
 */
export interface MarkdownEditorProps {
  /** Current content value (plain markdown text) */
  value: string;
  /** Callback when content changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Maximum character count */
  maxLength?: number;
  /** Minimum height for the editor */
  minHeight?: string;
  /** Enable preview mode toggle */
  enablePreview?: boolean;
  /** Show toolbar */
  showToolbar?: boolean;
  /** Show preview toggle without toolbar (useful when showToolbar=false) */
  showPreviewToggle?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show LaTeX toolbar button */
  enableLatex?: boolean;
  /** Enable @ mention autocomplete */
  enableMentions?: boolean;
  /** Enable # tag autocomplete */
  enableTags?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** Test ID for the editor container */
  testId?: string;
}

// =============================================================================
// TOOLBAR BUTTON
// =============================================================================

interface ToolbarButtonProps {
  onClick: () => void;
  disabled?: boolean;
  tooltip: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, disabled = false, tooltip, children }: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          size="sm"
          pressed={false}
          onPressedChange={() => onClick()}
          disabled={disabled}
          className="h-8 w-8 p-0"
        >
          {children}
        </Toggle>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

// =============================================================================
// MARKDOWN INSERTION UTILITIES
// =============================================================================

/**
 * Counts visible characters in markdown text, excluding syntax.
 *
 * @remarks
 * Used for character limit validation to count only user-visible text.
 */
function countVisibleCharacters(markdown: string): number {
  let text = markdown;
  // Remove encoded mentions/tags - keep only label (strip @/# prefix from count)
  text = text.replace(/\[@([^\]]+)\]\([^)]+\)/g, '@$1');
  text = text.replace(/\[#([^\]]+)\]\([^)]+\)/g, '#$1');
  // Remove standard markdown links - keep only label
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Remove formatting markers
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '$1');
  text = text.replace(/\*\*(.+?)\*\*/g, '$1');
  text = text.replace(/\*(.+?)\*/g, '$1');
  text = text.replace(/~~(.+?)~~/g, '$1');
  text = text.replace(/`([^`]+)`/g, '$1');
  return text.length;
}

/**
 * Inserts markdown syntax around selected text or at cursor.
 */
function insertMarkdown(
  editor: Editor,
  prefix: string,
  suffix: string = prefix,
  defaultText: string = ''
): void {
  const { from, to, empty } = editor.state.selection;

  if (empty) {
    // No selection, insert with placeholder
    const placeholder = defaultText || 'text';
    editor
      .chain()
      .focus()
      .insertContent(`${prefix}${placeholder}${suffix}`)
      .setTextSelection({
        from: from + prefix.length,
        to: from + prefix.length + placeholder.length,
      })
      .run();
  } else {
    // Wrap selection
    const selectedText = editor.state.doc.textBetween(from, to);
    editor
      .chain()
      .focus()
      .deleteSelection()
      .insertContent(`${prefix}${selectedText}${suffix}`)
      .run();
  }
}

/** Heading prefix pattern: matches `# `, `## `, `### `, etc. at line start */
const HEADING_PREFIX_REGEX = /^#{1,6} /;

/**
 * Inserts or toggles a line prefix (for headings, lists, quotes).
 *
 * @remarks
 * Uses ProseMirror's resolved position to find the correct block start,
 * avoiding the coordinate-system mismatch between textContent indices
 * and ProseMirror positions. For heading prefixes, toggles off if the
 * same prefix exists, or replaces a different heading prefix.
 */
function insertLinePrefix(editor: Editor, prefix: string): void {
  const { from } = editor.state.selection;
  const $pos = editor.state.doc.resolve(from);
  const blockStart = $pos.start($pos.depth);
  const blockEnd = $pos.end($pos.depth);
  const blockText = editor.state.doc.textBetween(blockStart, blockEnd, '');
  const isHeadingPrefix = /^#{1,6} $/.test(prefix);

  if (isHeadingPrefix) {
    const existingMatch = blockText.match(HEADING_PREFIX_REGEX);
    if (existingMatch) {
      const existingPrefix = existingMatch[0];
      if (existingPrefix === prefix) {
        // Same heading level: toggle off (remove prefix)
        editor
          .chain()
          .focus()
          .deleteRange({ from: blockStart, to: blockStart + existingPrefix.length })
          .run();
        return;
      }
      // Different heading level: replace prefix
      editor
        .chain()
        .focus()
        .deleteRange({ from: blockStart, to: blockStart + existingPrefix.length })
        .insertContentAt(blockStart, prefix)
        .run();
      return;
    }
  } else {
    // For non-heading prefixes (list, quote): toggle off if already present
    if (blockText.startsWith(prefix)) {
      editor
        .chain()
        .focus()
        .deleteRange({ from: blockStart, to: blockStart + prefix.length })
        .run();
      return;
    }
  }

  // Insert prefix at block start
  const cursorOffset = from - blockStart;
  editor
    .chain()
    .focus()
    .insertContentAt(blockStart, prefix)
    .setTextSelection(blockStart + cursorOffset + prefix.length)
    .run();
}

// =============================================================================
// SUGGESTION CONFIGURATIONS
// =============================================================================

/**
 * Creates mention suggestion configuration for TipTap.
 * @ mentions support both Bluesky users and object nodes from the knowledge graph.
 */
function createMentionSuggestion(enabled: boolean) {
  if (!enabled) {
    return undefined;
  }

  return {
    char: '@',
    allowSpaces: false,
    startOfLine: false,

    command: ({
      editor,
      range,
      props,
    }: {
      editor: Editor;
      range: { from: number; to: number };
      props: {
        id: string | null;
        label: string | null;
        itemType?: string;
        subkind?: string;
        uri?: string;
      };
    }) => {
      // Guard against null id (shouldn't happen in practice)
      if (!props.id || !props.label) return;

      // Select the trigger text range, then insert to replace it
      editor
        .chain()
        .focus()
        .setTextSelection(range)
        .insertContent([
          {
            type: 'markdownMention',
            attrs: {
              id: props.id,
              label: props.label,
              itemType: props.itemType,
              subkind: props.subkind,
              uri: props.uri,
            },
          },
          { type: 'text', text: ' ' },
        ])
        .run();
    },

    items: async ({ query }: { query: string }): Promise<SuggestionItem[]> => {
      editorLogger.debug('Mention items called', { query });

      if (!query || query.length < 1) {
        return [];
      }

      const results: SuggestionItem[] = [];

      // Fetch both Bluesky users and knowledge graph object nodes in parallel
      const [usersResult, nodesResult] = await Promise.allSettled([
        // Fetch Bluesky users
        fetch(
          `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(query)}&limit=5`
        ).then(async (response) => {
          if (response.ok) {
            const data = (await response.json()) as {
              actors: Array<{
                did: string;
                handle: string;
                displayName?: string;
                avatar?: string;
              }>;
            };
            return data.actors ?? [];
          }
          return [];
        }),

        // Fetch knowledge graph object nodes (institutions, people, etc.)
        api.pub.chive.graph
          .searchNodes({
            query,
            kind: 'object',
            status: 'established',
            limit: 5,
          })
          .then((response) => response.data.nodes ?? []),
      ]);

      // Add users to results
      if (usersResult.status === 'fulfilled') {
        results.push(
          ...usersResult.value.map((actor) => ({
            id: actor.did,
            label: actor.handle,
            displayName: actor.displayName,
            avatar: actor.avatar,
            itemType: 'user' as const,
          }))
        );
        editorLogger.debug('Mention actors received', { count: usersResult.value.length });
      } else {
        editorLogger.error('Mention user fetch failed', { error: usersResult.reason });
      }

      // Add graph nodes to results
      if (nodesResult.status === 'fulfilled') {
        results.push(
          ...nodesResult.value.map((node) => ({
            id: node.id,
            label: node.label,
            displayName: node.label,
            itemType: 'node' as const,
            kind: node.kind as 'type' | 'object',
            subkind: node.subkind,
            uri: node.uri,
            description: node.description,
          }))
        );
        editorLogger.debug('Mention nodes received', { count: nodesResult.value.length });
      } else {
        editorLogger.error('Mention node fetch failed', { error: nodesResult.reason });
      }

      return results;
    },

    render: () => {
      let component: ReactRenderer | null = null;
      let popup: TippyInstance | null = null;

      return {
        onStart: (props: {
          clientRect?: (() => DOMRect | null) | null;
          command: (item: {
            id: string;
            label: string;
            itemType?: string;
            subkind?: string;
            uri?: string;
          }) => void;
          items: SuggestionItem[];
          editor: Editor;
        }) => {
          editorLogger.debug('Mention suggestion started', { itemCount: props.items.length });
          component = new ReactRenderer(MentionList, {
            props: {
              items: props.items,
              command: (item: SuggestionItem) => {
                // Insert the markdown mention text with metadata
                props.command({
                  id: item.id,
                  label: item.label,
                  itemType: item.itemType,
                  subkind: item.subkind,
                  uri: item.uri,
                });
              },
            },
            editor: props.editor,
          });

          if (!props.clientRect) return;

          const rect = props.clientRect();
          if (!rect) return;

          popup = tippy(document.body, {
            getReferenceClientRect: () => rect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            hideOnClick: false,
          });
        },

        onUpdate: (props: {
          clientRect?: (() => DOMRect | null) | null;
          command: (item: {
            id: string;
            label: string;
            itemType?: string;
            subkind?: string;
            uri?: string;
          }) => void;
          items: SuggestionItem[];
        }) => {
          // Update both items AND command - command contains the updated range
          component?.updateProps({
            items: props.items,
            command: (item: SuggestionItem) => {
              props.command({
                id: item.id,
                label: item.label,
                itemType: item.itemType,
                subkind: item.subkind,
                uri: item.uri,
              });
            },
          });

          if (!props.clientRect) return;

          const rect = props.clientRect();
          if (rect) {
            popup?.setProps({
              getReferenceClientRect: () => rect,
            });
          }
        },

        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === 'Escape') {
            popup?.hide();
            return true;
          }

          // Let the component handle arrow keys and enter
          const componentRef = component?.ref as {
            onKeyDown?: (e: KeyboardEvent) => boolean;
          } | null;
          return componentRef?.onKeyDown?.(props.event) ?? false;
        },

        onExit: () => {
          popup?.destroy();
          component?.destroy();
        },
      };
    },
  };
}

/**
 * Creates tag suggestion configuration for TipTap.
 * # tags support both knowledge graph type nodes (fields, facets) and plain tags.
 */
function createTagSuggestion(enabled: boolean) {
  if (!enabled) {
    return undefined;
  }

  return {
    char: '#',
    allowSpaces: false,
    startOfLine: false,

    command: ({
      editor,
      range,
      props,
    }: {
      editor: Editor;
      range: { from: number; to: number };
      props: { id: string | null; label: string | null; itemType?: string; subkind?: string };
    }) => {
      // Guard against null id (shouldn't happen in practice)
      if (!props.id || !props.label) return;

      // Select the trigger text range, then insert to replace it
      editor
        .chain()
        .focus()
        .setTextSelection(range)
        .insertContent([
          {
            type: 'markdownTag',
            attrs: {
              id: props.id,
              label: props.label,
              itemType: props.itemType,
              subkind: props.subkind,
            },
          },
          { type: 'text', text: ' ' },
        ])
        .run();
    },

    items: async ({ query }: { query: string }): Promise<SuggestionItem[]> => {
      editorLogger.debug('Tag items called', { query });

      if (!query || query.length < 1) {
        return [];
      }

      const results: SuggestionItem[] = [];

      // Fetch knowledge graph type nodes (fields, facets, topics, etc.)
      try {
        const response = await api.pub.chive.graph.searchNodes({
          query,
          kind: 'type',
          status: 'established',
          limit: 8,
        });

        if (response.data.nodes) {
          results.push(
            ...response.data.nodes.map((node) => ({
              id: node.id,
              label: node.label,
              itemType: 'node' as const,
              kind: node.kind as 'type' | 'object',
              subkind: node.subkind,
              uri: node.uri,
              description: node.description,
            }))
          );
          editorLogger.debug('Tag nodes received', { count: response.data.nodes.length });
        }
      } catch (err) {
        editorLogger.error('Tag node fetch failed', { error: err });
      }

      // Always add the typed query as a plain tag option at the end
      results.push({
        id: query.toLowerCase(),
        label: query.toLowerCase(),
        itemType: 'tag' as const,
      });

      return results;
    },

    render: () => {
      let component: ReactRenderer | null = null;
      let popup: TippyInstance | null = null;

      return {
        onStart: (props: {
          clientRect?: (() => DOMRect | null) | null;
          command: (item: {
            id: string;
            label: string;
            itemType?: string;
            subkind?: string;
            uri?: string;
          }) => void;
          items: SuggestionItem[];
          editor: Editor;
        }) => {
          editorLogger.debug('Tag suggestion started', { itemCount: props.items.length });
          component = new ReactRenderer(TagList, {
            props: {
              items: props.items,
              command: (item: SuggestionItem) => {
                // Insert the markdown tag with metadata
                props.command({
                  id: item.id,
                  label: item.label,
                  itemType: item.itemType,
                  subkind: item.subkind,
                });
              },
            },
            editor: props.editor,
          });

          if (!props.clientRect) return;

          const rect = props.clientRect();
          if (!rect) return;

          popup = tippy(document.body, {
            getReferenceClientRect: () => rect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            hideOnClick: false,
          });
        },

        onUpdate: (props: {
          clientRect?: (() => DOMRect | null) | null;
          command: (item: {
            id: string;
            label: string;
            itemType?: string;
            subkind?: string;
            uri?: string;
          }) => void;
          items: SuggestionItem[];
        }) => {
          // Update both items AND command - command contains the updated range
          component?.updateProps({
            items: props.items,
            command: (item: SuggestionItem) => {
              props.command({
                id: item.id,
                label: item.label,
                itemType: item.itemType,
                subkind: item.subkind,
              });
            },
          });

          if (!props.clientRect) return;

          const rect = props.clientRect();
          if (rect) {
            popup?.setProps({
              getReferenceClientRect: () => rect,
            });
          }
        },

        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === 'Escape') {
            popup?.hide();
            return true;
          }

          const componentRef = component?.ref as {
            onKeyDown?: (e: KeyboardEvent) => boolean;
          } | null;
          return componentRef?.onKeyDown?.(props.event) ?? false;
        },

        onExit: () => {
          popup?.destroy();
          component?.destroy();
        },
      };
    },
  };
}

// =============================================================================
// CUSTOM MENTION EXTENSION FOR MARKDOWN OUTPUT
// =============================================================================

/**
 * Custom mention extension that outputs plain markdown text instead of nodes.
 * Encodes metadata for chip rendering in preview.
 */
const MarkdownMention = Mention.extend({
  name: 'markdownMention',

  addAttributes() {
    return {
      id: { default: null },
      label: { default: null },
      itemType: { default: null },
      subkind: { default: null },
      uri: { default: null },
    };
  },

  renderHTML({ node }) {
    // Render as plain text in the DOM
    return ['span', { class: 'text-primary' }, `@${node.attrs.label}`];
  },

  renderText({ node }) {
    // Encode metadata in markdown link format for parsing in preview
    if (node.attrs.itemType === 'user') {
      return `[@${node.attrs.label}](user:${node.attrs.id})`;
    } else if (node.attrs.itemType === 'node') {
      return `[@${node.attrs.label}](node:${node.attrs.id}#${node.attrs.subkind || 'default'})`;
    }
    return `@${node.attrs.label}`;
  },
});

/**
 * Custom tag extension that outputs plain markdown text instead of nodes.
 * Encodes metadata for chip rendering in preview.
 */
const MarkdownTag = Mention.extend({
  name: 'markdownTag',

  addAttributes() {
    return {
      id: { default: null },
      label: { default: null },
      itemType: { default: null },
      subkind: { default: null },
    };
  },

  renderHTML({ node }) {
    return ['span', { class: 'text-primary' }, `#${node.attrs.label}`];
  },

  renderText({ node }) {
    // Encode metadata in markdown link format for parsing in preview
    if (node.attrs.itemType === 'node') {
      return `[#${node.attrs.label}](type:${node.attrs.id}#${node.attrs.subkind || 'default'})`;
    }
    return `#${node.attrs.label}`;
  },
});

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Markdown editor with plaintext input and preview support.
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write using Markdown...',
  disabled = false,
  maxLength,
  minHeight = '150px',
  enablePreview = true,
  showToolbar = true,
  showPreviewToggle = false,
  className,
  enableLatex = true,
  enableMentions = true,
  enableTags = true,
  autoFocus = false,
  ariaLabel = 'Markdown editor',
  testId,
}: MarkdownEditorProps) {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // Build extensions array - memoized to prevent re-creation on every render
  const extensions = useMemo(() => {
    const exts = [
      Document,
      Paragraph,
      Text,
      History,
      Placeholder.configure({
        placeholder,
      }),
    ];

    // Add mention extension if enabled
    if (enableMentions) {
      const mentionSuggestion = createMentionSuggestion(true);
      if (mentionSuggestion) {
        exts.push(
          MarkdownMention.configure({
            // Type assertion needed because our custom suggestion props extend the base type
            suggestion: mentionSuggestion as MentionOptions['suggestion'],
          })
        );
      }
    }

    // Add tag extension if enabled
    if (enableTags) {
      const tagSuggestion = createTagSuggestion(true);
      if (tagSuggestion) {
        exts.push(
          MarkdownTag.configure({
            // Type assertion needed because our custom suggestion props extend the base type
            suggestion: tagSuggestion as MentionOptions['suggestion'],
          })
        );
      }
    }

    return exts;
  }, [placeholder, enableMentions, enableTags]);

  // Initialize TipTap editor for plaintext
  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: value || '',
    editable: !disabled && !isPreviewMode,
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      onChange(text);
    },
    editorProps: {
      attributes: {
        class: cn('font-mono text-sm', 'focus:outline-none', 'px-3 py-2', 'whitespace-pre-wrap'),
        style: `min-height: ${minHeight}`,
        'aria-label': ariaLabel,
      },
    },
  });

  // Handle mounting
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && editor && !disabled) {
      editor.commands.focus();
    }
  }, [autoFocus, editor, disabled]);

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getText()) {
      editor.commands.setContent(value || '');
    }
  }, [editor, value]);

  // Update editable state when preview mode changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled && !isPreviewMode);
    }
  }, [editor, disabled, isPreviewMode]);

  // Toggle preview mode
  const togglePreview = useCallback(() => {
    setIsPreviewMode((prev) => !prev);
  }, []);

  // Toolbar actions that insert markdown syntax
  const insertBold = useCallback(() => {
    if (editor) insertMarkdown(editor, '**', '**', 'bold text');
  }, [editor]);

  const insertItalic = useCallback(() => {
    if (editor) insertMarkdown(editor, '*', '*', 'italic text');
  }, [editor]);

  const insertStrikethrough = useCallback(() => {
    if (editor) insertMarkdown(editor, '~~', '~~', 'strikethrough text');
  }, [editor]);

  const insertCode = useCallback(() => {
    if (editor) insertMarkdown(editor, '`', '`', 'code');
  }, [editor]);

  const insertCodeBlock = useCallback(() => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) {
      editor
        .chain()
        .focus()
        .insertContent('```\ncode\n```')
        .setTextSelection({ from: from + 4, to: from + 8 })
        .run();
    } else {
      const selectedText = editor.state.doc.textBetween(from, to);
      editor
        .chain()
        .focus()
        .deleteSelection()
        .insertContent(`\`\`\`\n${selectedText}\n\`\`\``)
        .run();
    }
  }, [editor]);

  const insertHeading1 = useCallback(() => {
    if (editor) insertLinePrefix(editor, '# ');
  }, [editor]);

  const insertHeading2 = useCallback(() => {
    if (editor) insertLinePrefix(editor, '## ');
  }, [editor]);

  const insertBulletList = useCallback(() => {
    if (editor) insertLinePrefix(editor, '- ');
  }, [editor]);

  const insertOrderedList = useCallback(() => {
    if (editor) insertLinePrefix(editor, '1. ');
  }, [editor]);

  const insertBlockquote = useCallback(() => {
    if (editor) insertLinePrefix(editor, '> ');
  }, [editor]);

  const insertLink = useCallback(() => {
    if (!editor) return;

    const { from, to, empty } = editor.state.selection;
    const url = window.prompt('Enter URL', 'https://');

    if (url === null) return;

    if (empty) {
      editor
        .chain()
        .focus()
        .insertContent(`[link text](${url})`)
        .setTextSelection({ from: from + 1, to: from + 10 })
        .run();
    } else {
      const selectedText = editor.state.doc.textBetween(from, to);
      editor.chain().focus().deleteSelection().insertContent(`[${selectedText}](${url})`).run();
    }
  }, [editor]);

  const insertLatex = useCallback(() => {
    if (!editor) return;

    const { from, to, empty } = editor.state.selection;

    if (empty) {
      // Insert inline math placeholder
      editor
        .chain()
        .focus()
        .insertContent('$equation$')
        .setTextSelection({ from: from + 1, to: from + 9 })
        .run();
    } else {
      // Wrap selection in math delimiters
      const selectedText = editor.state.doc.textBetween(from, to);
      editor.chain().focus().deleteSelection().insertContent(`$${selectedText}$`).run();
    }
  }, [editor]);

  const insertMention = useCallback(() => {
    if (editor) {
      editor.chain().focus().insertContent('@').run();
    }
  }, [editor]);

  const insertTag = useCallback(() => {
    if (editor) {
      editor.chain().focus().insertContent('#').run();
    }
  }, [editor]);

  // Calculate character count (visible characters only, excluding markdown syntax)
  const charCount = value ? countVisibleCharacters(value) : 0;
  const isOverLimit = maxLength !== undefined && charCount > maxLength;

  // Don't render editor on server
  if (!isMounted) {
    return (
      <div
        className={cn('rounded-md border bg-background', disabled && 'opacity-50', className)}
        style={{ minHeight }}
      />
    );
  }

  return (
    <TooltipProvider>
      <div
        ref={editorRef}
        className={cn(
          'rounded-md border bg-background',
          'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          disabled && 'opacity-50 pointer-events-none',
          isOverLimit && 'border-destructive',
          className
        )}
        data-testid={testId}
        data-disabled={disabled || undefined}
      >
        {/* Toolbar */}
        {showToolbar && (
          <div className="flex items-center gap-1 border-b px-2 py-1 flex-wrap">
            {/* Text formatting */}
            <ToolbarButton
              onClick={insertBold}
              disabled={disabled || isPreviewMode}
              tooltip="Bold (**text**)"
            >
              <Bold className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={insertItalic}
              disabled={disabled || isPreviewMode}
              tooltip="Italic (*text*)"
            >
              <Italic className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={insertStrikethrough}
              disabled={disabled || isPreviewMode}
              tooltip="Strikethrough (~~text~~)"
            >
              <Strikethrough className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={insertCode}
              disabled={disabled || isPreviewMode}
              tooltip="Inline code (`code`)"
            >
              <Code className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={insertCodeBlock}
              disabled={disabled || isPreviewMode}
              tooltip="Code block (```code```)"
            >
              <SquareCode className="h-4 w-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1 h-6" />

            {/* Headings */}
            <ToolbarButton
              onClick={insertHeading1}
              disabled={disabled || isPreviewMode}
              tooltip="Heading 1 (# text)"
            >
              <Heading1 className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={insertHeading2}
              disabled={disabled || isPreviewMode}
              tooltip="Heading 2 (## text)"
            >
              <Heading2 className="h-4 w-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1 h-6" />

            {/* Lists */}
            <ToolbarButton
              onClick={insertBulletList}
              disabled={disabled || isPreviewMode}
              tooltip="Bullet list (- item)"
            >
              <List className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={insertOrderedList}
              disabled={disabled || isPreviewMode}
              tooltip="Numbered list (1. item)"
            >
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={insertBlockquote}
              disabled={disabled || isPreviewMode}
              tooltip="Quote (> text)"
            >
              <Quote className="h-4 w-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1 h-6" />

            {/* Link */}
            <ToolbarButton
              onClick={insertLink}
              disabled={disabled || isPreviewMode}
              tooltip="Insert link ([text](url))"
            >
              <LinkIcon className="h-4 w-4" />
            </ToolbarButton>

            {/* LaTeX */}
            {enableLatex && (
              <ToolbarButton
                onClick={insertLatex}
                disabled={disabled || isPreviewMode}
                tooltip="Insert LaTeX ($...$)"
              >
                <Sigma className="h-4 w-4" />
              </ToolbarButton>
            )}

            <Separator orientation="vertical" className="mx-1 h-6" />

            {/* Mentions and Tags */}
            {enableMentions && (
              <ToolbarButton
                onClick={insertMention}
                disabled={disabled || isPreviewMode}
                tooltip="Mention user (@handle)"
              >
                <AtSign className="h-4 w-4" />
              </ToolbarButton>
            )}

            {enableTags && (
              <ToolbarButton
                onClick={insertTag}
                disabled={disabled || isPreviewMode}
                tooltip="Add tag (#tag)"
              >
                <Hash className="h-4 w-4" />
              </ToolbarButton>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Preview toggle */}
            {enablePreview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={togglePreview}
                className="gap-1 h-8"
              >
                {isPreviewMode ? (
                  <>
                    <Edit3 className="h-4 w-4" />
                    Edit
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Preview
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Standalone preview toggle when toolbar is hidden */}
        {!showToolbar && showPreviewToggle && enablePreview && (
          <div className="flex items-center justify-end border-b px-2 py-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={togglePreview}
              className="gap-1 h-8"
            >
              {isPreviewMode ? (
                <>
                  <Edit3 className="h-4 w-4" />
                  Edit
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Preview
                </>
              )}
            </Button>
          </div>
        )}

        {/* Editor / Preview content */}
        <div className="relative">
          {isPreviewMode ? (
            <MarkdownPreviewPane content={value} className="px-3 py-2" minHeight={minHeight} />
          ) : (
            <EditorContent editor={editor} />
          )}
        </div>

        {/* Footer with character count */}
        {maxLength !== undefined && (
          <div className="flex items-center justify-end border-t px-3 py-1">
            <span
              className={cn(
                'text-xs tabular-nums text-muted-foreground',
                isOverLimit && 'text-destructive font-medium'
              )}
            >
              {charCount}/{maxLength}
            </span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export default MarkdownEditor;
