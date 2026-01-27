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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, ReactRenderer, Editor } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import History from '@tiptap/extension-history';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
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
import type { SuggestionItem } from './suggestion-list';
import { MentionList, TagList } from './suggestion-list';
import { MarkdownPreviewPane } from './markdown-preview-pane';

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

/**
 * Inserts a line prefix (for headings, lists, quotes).
 */
function insertLinePrefix(editor: Editor, prefix: string): void {
  const { from } = editor.state.selection;

  // Find start of current line
  let lineStart = from;
  const docText = editor.state.doc.textContent;
  while (lineStart > 0 && docText[lineStart - 1] !== '\n') {
    lineStart--;
  }

  // Insert prefix at line start
  editor
    .chain()
    .focus()
    .setTextSelection(lineStart)
    .insertContent(prefix)
    .setTextSelection(from + prefix.length)
    .run();
}

// =============================================================================
// SUGGESTION CONFIGURATIONS
// =============================================================================

/**
 * Creates mention suggestion configuration for TipTap.
 */
function createMentionSuggestion(enabled: boolean) {
  if (!enabled) {
    return undefined;
  }

  return {
    char: '@',
    allowSpaces: false,
    startOfLine: false,

    items: async ({ query }: { query: string }): Promise<SuggestionItem[]> => {
      if (!query || query.length < 1) {
        return [];
      }

      try {
        const response = await fetch(
          `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(query)}&limit=8`
        );

        if (response.ok) {
          const data = (await response.json()) as {
            actors: Array<{
              did: string;
              handle: string;
              displayName?: string;
              avatar?: string;
            }>;
          };
          return (
            data.actors?.map((actor) => ({
              id: actor.did,
              label: actor.handle,
              displayName: actor.displayName,
              avatar: actor.avatar,
            })) ?? []
          );
        }
      } catch {
        // Silently fail on network errors
      }

      return [];
    },

    render: () => {
      let component: ReactRenderer | null = null;
      let popup: TippyInstance | null = null;

      return {
        onStart: (props: {
          clientRect?: (() => DOMRect | null) | null;
          command: (item: { id: string; label: string }) => void;
          items: SuggestionItem[];
          editor: Editor;
        }) => {
          component = new ReactRenderer(MentionList, {
            props: {
              items: props.items,
              command: (item: SuggestionItem) => {
                // Insert the markdown mention text
                props.command({ id: item.id, label: item.label });
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
          });
        },

        onUpdate: (props: {
          clientRect?: (() => DOMRect | null) | null;
          items: SuggestionItem[];
        }) => {
          component?.updateProps({
            items: props.items,
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
 */
function createTagSuggestion(enabled: boolean) {
  if (!enabled) {
    return undefined;
  }

  return {
    char: '#',
    allowSpaces: false,
    startOfLine: false,

    items: async ({ query }: { query: string }): Promise<SuggestionItem[]> => {
      if (!query || query.length < 1) {
        return [];
      }

      // For tags, we could query a tag API or just return the typed query as a suggestion
      // For now, return the query itself as the primary suggestion
      return [
        {
          id: query.toLowerCase(),
          label: query.toLowerCase(),
        },
      ];
    },

    render: () => {
      let component: ReactRenderer | null = null;
      let popup: TippyInstance | null = null;

      return {
        onStart: (props: {
          clientRect?: (() => DOMRect | null) | null;
          command: (item: { id: string; label: string }) => void;
          items: SuggestionItem[];
          editor: Editor;
        }) => {
          component = new ReactRenderer(TagList, {
            props: {
              items: props.items,
              command: (item: SuggestionItem) => {
                props.command({ id: item.id, label: item.label });
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
          });
        },

        onUpdate: (props: {
          clientRect?: (() => DOMRect | null) | null;
          items: SuggestionItem[];
        }) => {
          component?.updateProps({
            items: props.items,
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
 */
const MarkdownMention = Mention.extend({
  name: 'markdownMention',

  addAttributes() {
    return {
      id: { default: null },
      label: { default: null },
    };
  },

  renderHTML({ node }) {
    // Render as plain text in the DOM
    return ['span', { class: 'text-primary' }, `@${node.attrs.label}`];
  },

  renderText({ node }) {
    return `@${node.attrs.label}`;
  },
});

/**
 * Custom tag extension that outputs plain markdown text instead of nodes.
 */
const MarkdownTag = Mention.extend({
  name: 'markdownTag',

  addAttributes() {
    return {
      id: { default: null },
      label: { default: null },
    };
  },

  renderHTML({ node }) {
    return ['span', { class: 'text-primary' }, `#${node.attrs.label}`];
  },

  renderText({ node }) {
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

  // Build extensions array
  const extensions = [
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
      extensions.push(
        MarkdownMention.configure({
          suggestion: mentionSuggestion,
        })
      );
    }
  }

  // Add tag extension if enabled
  if (enableTags) {
    const tagSuggestion = createTagSuggestion(true);
    if (tagSuggestion) {
      extensions.push(
        MarkdownTag.configure({
          suggestion: tagSuggestion,
        })
      );
    }
  }

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

  // Calculate character count
  const charCount = value?.length || 0;
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
              <Button variant="ghost" size="sm" onClick={togglePreview} className="gap-1 h-8">
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
