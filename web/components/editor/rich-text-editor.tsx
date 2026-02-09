'use client';

/**
 * Rich text editor with Markdown and LaTeX support.
 *
 * @remarks
 * A TipTap-based editor that supports:
 * - Markdown-style formatting (bold, italic, lists, headings)
 * - LaTeX math expressions (inline $...$ and display $$...$$)
 * - Preview mode toggle
 * - ATProto-compatible rich text output with facets
 *
 * @example
 * ```tsx
 * <RichTextEditor
 *   value={content}
 *   onChange={setContent}
 *   placeholder="Write your abstract..."
 *   enablePreview
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent, ReactRenderer, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
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
  Heading3,
  Link as LinkIcon,
  Eye,
  Edit3,
  Sigma,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api/client';
import { logger } from '@/lib/observability';
import { LatexExtension } from './extensions/latex-extension';
import { CrossReferenceExtension } from './extensions/cross-reference-extension';
import { CrossReferenceList, type CrossReferenceItem } from './cross-reference-list';
import { MarkdownPreview } from './markdown-preview';
import type { RichTextContent, RichTextFacet } from './types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for RichTextEditor component.
 */
export interface RichTextEditorProps {
  /** Current content value */
  value: RichTextContent;
  /** Callback when content changes */
  onChange: (content: RichTextContent) => void;
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
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** Test ID for the editor container */
  testId?: string;
  /** AT-URI of the eprint (enables [[ cross-reference autocomplete) */
  eprintUri?: string;
}

// =============================================================================
// TOOLBAR BUTTON
// =============================================================================

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  tooltip: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  tooltip,
  children,
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          size="sm"
          pressed={isActive}
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
// CROSS-REFERENCE SUGGESTION
// =============================================================================

const crossRefLogger = logger.child({ component: 'cross-reference-suggestion' });

/**
 * Creates the suggestion configuration for [[ cross-reference autocomplete.
 *
 * @param eprintUri - AT-URI of the current eprint
 * @returns Suggestion options for CrossReferenceExtension
 */
function createCrossReferenceSuggestion(eprintUri: string) {
  return {
    char: '[[',
    allowSpaces: true,

    items: async ({ query }: { query: string }): Promise<CrossReferenceItem[]> => {
      crossRefLogger.debug('Cross-reference items called', { query, eprintUri });

      try {
        const response = await api.pub.chive.review.listForEprint({
          eprintUri,
          limit: 20,
        });

        const reviews = response.data.reviews ?? [];
        const results: CrossReferenceItem[] = reviews.map((review) => {
          const isAnnotation = review.motivation === 'highlighting' || !!review.target;
          const authorLabel =
            review.author.displayName ?? review.author.handle ?? review.author.did.slice(0, 12);
          const preview = review.content.slice(0, 60) + (review.content.length > 60 ? '...' : '');

          return {
            uri: review.uri,
            label: authorLabel,
            type: isAnnotation ? ('annotation' as const) : ('review' as const),
            contentPreview: preview,
          };
        });

        // Filter by query if provided
        if (query) {
          const lowerQuery = query.toLowerCase();
          return results.filter(
            (item) =>
              item.label.toLowerCase().includes(lowerQuery) ||
              item.contentPreview.toLowerCase().includes(lowerQuery)
          );
        }

        return results;
      } catch (err) {
        crossRefLogger.error('Cross-reference fetch failed', { error: err });
        return [];
      }
    },

    command: ({
      editor,
      range,
      props,
    }: {
      editor: Editor;
      range: { from: number; to: number };
      props: CrossReferenceItem;
    }) => {
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

    render: () => {
      let component: ReactRenderer | null = null;
      let popup: TippyInstance | null = null;

      return {
        onStart: (props: {
          clientRect?: (() => DOMRect | null) | null;
          command: (item: CrossReferenceItem) => void;
          items: CrossReferenceItem[];
          editor: Editor;
        }) => {
          component = new ReactRenderer(CrossReferenceList, {
            props: {
              items: props.items,
              command: props.command,
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
          command: (item: CrossReferenceItem) => void;
          items: CrossReferenceItem[];
        }) => {
          component?.updateProps({
            items: props.items,
            command: props.command,
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
// COMPONENT
// =============================================================================

/**
 * Rich text editor with Markdown and LaTeX support.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start writing...',
  disabled = false,
  maxLength,
  minHeight = '150px',
  enablePreview = true,
  showToolbar = true,
  className,
  enableLatex = true,
  autoFocus = false,
  ariaLabel = 'Rich text editor',
  testId,
  eprintUri,
}: RichTextEditorProps) {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Initialize TipTap editor
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        // Disable link from StarterKit since we configure it separately
        link: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      ...(enableLatex ? [LatexExtension] : []),
      ...(eprintUri
        ? [
            CrossReferenceExtension.configure({
              suggestion: createCrossReferenceSuggestion(eprintUri),
            }),
          ]
        : []),
    ],
    content: value.text || '',
    editable: !disabled && !isPreviewMode,
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      const html = editor.getHTML();
      const facets = extractFacetsFromEditor(editor);

      onChange({
        text,
        html,
        facets,
      });
    },
    editorProps: {
      attributes: {
        class: cn('prose prose-sm dark:prose-invert max-w-none', 'focus:outline-none', 'px-3 py-2'),
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
    if (editor && value.text !== editor.getText()) {
      editor.commands.setContent(value.html || value.text || '');
    }
  }, [editor, value]);

  // Toggle preview mode
  const togglePreview = useCallback(() => {
    setIsPreviewMode((prev) => !prev);
  }, []);

  // Insert LaTeX
  const insertLatex = useCallback(() => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, '');

    if (selectedText) {
      // Wrap selection in LaTeX
      editor.commands.setLatex({ latex: selectedText, displayMode: false });
    } else {
      // Insert placeholder
      editor.commands.insertContent('$\\text{equation}$');
    }
  }, [editor]);

  // Set link
  const setLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Enter URL', previousUrl || 'https://');

    if (url === null) return;

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  // Calculate character count
  const charCount = value.text?.length || 0;
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
              onClick={() => editor?.chain().focus().toggleBold().run()}
              isActive={editor?.isActive('bold')}
              disabled={disabled || isPreviewMode}
              tooltip="Bold (Ctrl+B)"
            >
              <Bold className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              isActive={editor?.isActive('italic')}
              disabled={disabled || isPreviewMode}
              tooltip="Italic (Ctrl+I)"
            >
              <Italic className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleStrike().run()}
              isActive={editor?.isActive('strike')}
              disabled={disabled || isPreviewMode}
              tooltip="Strikethrough"
            >
              <Strikethrough className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleCode().run()}
              isActive={editor?.isActive('code')}
              disabled={disabled || isPreviewMode}
              tooltip="Inline code"
            >
              <Code className="h-4 w-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1 h-6" />

            {/* Headings */}
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
              isActive={editor?.isActive('heading', { level: 1 })}
              disabled={disabled || isPreviewMode}
              tooltip="Heading 1"
            >
              <Heading1 className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              isActive={editor?.isActive('heading', { level: 2 })}
              disabled={disabled || isPreviewMode}
              tooltip="Heading 2"
            >
              <Heading2 className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
              isActive={editor?.isActive('heading', { level: 3 })}
              disabled={disabled || isPreviewMode}
              tooltip="Heading 3"
            >
              <Heading3 className="h-4 w-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1 h-6" />

            {/* Lists */}
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              isActive={editor?.isActive('bulletList')}
              disabled={disabled || isPreviewMode}
              tooltip="Bullet list"
            >
              <List className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              isActive={editor?.isActive('orderedList')}
              disabled={disabled || isPreviewMode}
              tooltip="Numbered list"
            >
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              isActive={editor?.isActive('blockquote')}
              disabled={disabled || isPreviewMode}
              tooltip="Quote"
            >
              <Quote className="h-4 w-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1 h-6" />

            {/* Link */}
            <ToolbarButton
              onClick={setLink}
              isActive={editor?.isActive('link')}
              disabled={disabled || isPreviewMode}
              tooltip="Insert link"
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
            <MarkdownPreview content={value} className="px-3 py-2" minHeight={minHeight} />
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

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Extract ATProto-compatible facets from TipTap editor state.
 *
 * @param editor - TipTap editor instance
 * @returns Array of facets with byte ranges and features
 */
function extractFacetsFromEditor(editor: ReturnType<typeof useEditor>): RichTextFacet[] {
  if (!editor) return [];

  const facets: RichTextFacet[] = [];
  const encoder = new TextEncoder();
  let byteOffset = 0;

  // Walk through the document to extract marks and nodes
  editor.state.doc.descendants((node, _pos) => {
    if (node.isText && node.text) {
      const nodeText = node.text;
      const nodeBytes = encoder.encode(nodeText);
      const nodeByteStart = byteOffset;
      const nodeByteEnd = byteOffset + nodeBytes.length;

      // Check for marks on this text node
      node.marks.forEach((mark) => {
        if (mark.type.name === 'bold') {
          facets.push({
            index: { byteStart: nodeByteStart, byteEnd: nodeByteEnd },
            features: [{ $type: 'pub.chive.richtext.facets#bold' }],
          });
        }
        if (mark.type.name === 'italic') {
          facets.push({
            index: { byteStart: nodeByteStart, byteEnd: nodeByteEnd },
            features: [{ $type: 'pub.chive.richtext.facets#italic' }],
          });
        }
        if (mark.type.name === 'strike') {
          facets.push({
            index: { byteStart: nodeByteStart, byteEnd: nodeByteEnd },
            features: [{ $type: 'pub.chive.richtext.facets#strikethrough' }],
          });
        }
        if (mark.type.name === 'code') {
          facets.push({
            index: { byteStart: nodeByteStart, byteEnd: nodeByteEnd },
            features: [{ $type: 'pub.chive.richtext.facets#code' }],
          });
        }
        if (mark.type.name === 'link') {
          facets.push({
            index: { byteStart: nodeByteStart, byteEnd: nodeByteEnd },
            features: [{ $type: 'app.bsky.richtext.facet#link', uri: mark.attrs.href as string }],
          });
        }
      });

      byteOffset += nodeBytes.length;
    } else if (node.type.name === 'latex') {
      // Handle LaTeX nodes
      const latex = node.attrs.latex as string;
      const displayMode = node.attrs.displayMode as boolean;
      const latexBytes = encoder.encode(latex);

      facets.push({
        index: { byteStart: byteOffset, byteEnd: byteOffset + latexBytes.length },
        features: [{ $type: 'pub.chive.richtext.facets#latex', displayMode }],
      });

      byteOffset += latexBytes.length;
    } else if (node.type.name === 'crossReference') {
      // Handle cross-reference nodes
      const label = node.attrs.label as string;
      const labelBytes = encoder.encode(label);

      facets.push({
        index: { byteStart: byteOffset, byteEnd: byteOffset + labelBytes.length },
        features: [
          {
            $type: 'pub.chive.richtext.facets#crossReference',
            uri: node.attrs.uri as string,
          },
        ],
      });

      byteOffset += labelBytes.length;
    } else if (node.type.name === 'paragraph' || node.type.name === 'hardBreak') {
      // Add newline
      byteOffset += 1;
    }

    return true;
  });

  return facets;
}

export default RichTextEditor;
