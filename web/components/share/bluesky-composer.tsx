'use client';

/**
 * Bluesky post composer with @mention autocomplete using TipTap.
 *
 * @remarks
 * Uses TipTap rich text editor with Mention extension for industry-standard
 * mention handling, following Bluesky's own implementation pattern.
 */

import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import { cn } from '@/lib/utils';

/**
 * Actor suggestion from Bluesky API.
 */
export interface ActorSuggestion {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

/**
 * Props for the BlueskyComposer component.
 */
interface BlueskyComposerProps {
  /** Current text value */
  value: string;
  /** Called when text changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Minimum height */
  minHeight?: number;
  /** Maximum height for auto-resize */
  maxHeight?: number;
}

/**
 * Search actors using Bluesky public API.
 */
async function searchActors(query: string): Promise<ActorSuggestion[]> {
  if (!query || query.length < 1) {
    return [];
  }

  try {
    const response = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(query)}&limit=8`
    );

    if (response.ok) {
      const data = (await response.json()) as { actors: ActorSuggestion[] };
      return data.actors || [];
    }
  } catch {
    // Silently fail on network errors
  }

  return [];
}

/**
 * TipTap Mention suggestion configuration.
 */
function createMentionSuggestion() {
  return {
    items: async ({ query }: { query: string }) => {
      return await searchActors(query);
    },

    render: () => {
      let popup: HTMLDivElement | null = null;
      let selectedIndex = 0;
      let items: ActorSuggestion[] = [];
      let command: ((props: { id: string; label: string }) => void) | null = null;

      const updatePopup = () => {
        if (!popup) return;

        if (items.length === 0) {
          popup.innerHTML = `
            <div class="p-3 text-center text-sm text-muted-foreground">
              No users found
            </div>
          `;
          return;
        }

        popup.innerHTML = items
          .map(
            (item, index) => `
            <div
              class="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent ${
                index === selectedIndex ? 'bg-accent' : ''
              }"
              data-index="${index}"
              role="option"
              aria-selected="${index === selectedIndex}"
            >
              ${
                item.avatar
                  ? `<img src="${item.avatar}" alt="" class="h-8 w-8 rounded-full object-cover" />`
                  : `<div class="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <svg class="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>`
              }
              <div class="flex-1 overflow-hidden">
                ${item.displayName ? `<p class="truncate text-sm font-medium">${item.displayName}</p>` : ''}
                <p class="truncate text-sm text-muted-foreground">@${item.handle}</p>
              </div>
            </div>
          `
          )
          .join('');

        // Add click handlers
        popup.querySelectorAll('[data-index]').forEach((el) => {
          el.addEventListener('click', () => {
            const index = parseInt(el.getAttribute('data-index') || '0');
            const item = items[index];
            if (item && command) {
              command({ id: item.did, label: item.handle });
            }
          });
        });
      };

      return {
        onStart: (props: {
          clientRect?: (() => DOMRect | null) | null;
          command: (props: { id: string; label: string }) => void;
        }) => {
          command = props.command;
          popup = document.createElement('div');
          popup.className =
            'absolute z-50 w-72 rounded-md border bg-popover shadow-lg max-h-60 overflow-auto';
          popup.setAttribute('role', 'listbox');

          const rect = props.clientRect?.();
          if (rect) {
            popup.style.top = `${rect.bottom + window.scrollY + 4}px`;
            popup.style.left = `${rect.left + window.scrollX}px`;
          }

          document.body.appendChild(popup);
          updatePopup();
        },

        onUpdate: (props: {
          items: ActorSuggestion[];
          clientRect?: (() => DOMRect | null) | null;
        }) => {
          items = props.items;
          selectedIndex = 0;

          const rect = props.clientRect?.();
          if (popup && rect) {
            popup.style.top = `${rect.bottom + window.scrollY + 4}px`;
            popup.style.left = `${rect.left + window.scrollX}px`;
          }

          updatePopup();
        },

        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === 'ArrowDown') {
            selectedIndex = (selectedIndex + 1) % Math.max(items.length, 1);
            updatePopup();
            return true;
          }

          if (props.event.key === 'ArrowUp') {
            selectedIndex = (selectedIndex - 1 + items.length) % Math.max(items.length, 1);
            updatePopup();
            return true;
          }

          if (props.event.key === 'Enter' || props.event.key === 'Tab') {
            const item = items[selectedIndex];
            if (item && command) {
              command({ id: item.did, label: item.handle });
              return true;
            }
          }

          if (props.event.key === 'Escape') {
            // Stop propagation to prevent dialog from closing
            props.event.stopPropagation();
            popup?.remove();
            popup = null;
            return true;
          }

          return false;
        },

        onExit: () => {
          popup?.remove();
          popup = null;
        },
      };
    },
  };
}

/**
 * Bluesky post composer component using TipTap.
 *
 * @example
 * ```tsx
 * <BlueskyComposer
 *   value={text}
 *   onChange={setText}
 *   placeholder="What's on your mind?"
 * />
 * ```
 */
export function BlueskyComposer({
  value,
  onChange,
  placeholder = "What's on your mind?",
  disabled = false,
  className,
  minHeight = 100,
  maxHeight = 300,
}: BlueskyComposerProps) {
  const [isMounted, setIsMounted] = useState(false);

  // TipTap editor configuration
  const editor = useEditor({
    immediatelyRender: false, // Required for SSR compatibility
    extensions: [
      StarterKit.configure({
        // Disable features we don't need
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'text-primary font-medium',
        },
        suggestion: createMentionSuggestion(),
      }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      // Extract plain text from TipTap (including mention handles)
      const text = editor.getText();
      onChange(text);
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none',
          'focus:outline-none',
          'min-h-[100px] p-3',
          className
        ),
        style: `min-height: ${minHeight}px; max-height: ${maxHeight}px; overflow-y: auto;`,
        'aria-label': 'Post composer',
      },
    },
  });

  // Handle mounting
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync external value changes to editor
  useEffect(() => {
    if (editor && value !== editor.getText()) {
      // Only update if value is empty (reset case)
      if (value === '') {
        editor.commands.clearContent();
      }
    }
  }, [editor, value]);

  // Don't render on server
  if (!isMounted) {
    return (
      <div
        className={cn('rounded-md border bg-background', disabled && 'opacity-50', className)}
        style={{ minHeight: `${minHeight}px` }}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

// Re-export AutocompleteTrigger for backwards compatibility (no longer used)
export interface AutocompleteTrigger {
  type: 'mention' | 'hashtag';
  query: string;
  startIndex: number;
  cursorPosition: number;
  position: { top: number; left: number };
}
