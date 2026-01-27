'use client';

/**
 * Suggestion list components for TipTap autocomplete.
 *
 * @remarks
 * Provides dropdown UI for @ mentions and # tags in the markdown editor.
 *
 * @packageDocumentation
 */

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { User, Hash } from 'lucide-react';

import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Suggestion item for autocomplete.
 */
export interface SuggestionItem {
  /** Unique identifier */
  id: string;
  /** Display label (handle for mentions, tag name for tags) */
  label: string;
  /** Optional display name for mentions */
  displayName?: string;
  /** Optional avatar URL for mentions */
  avatar?: string;
}

/**
 * Props for suggestion list components.
 */
export interface SuggestionListProps {
  /** Available items to display */
  items: SuggestionItem[];
  /** Callback when item is selected */
  command: (item: SuggestionItem) => void;
}

/**
 * Ref interface for keyboard navigation.
 */
export interface SuggestionListRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

// =============================================================================
// MENTION LIST
// =============================================================================

/**
 * Dropdown list for @ mention suggestions.
 */
export const MentionList = forwardRef<SuggestionListRef, SuggestionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: (event: KeyboardEvent): boolean => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
          return true;
        }

        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }

        if (event.key === 'Enter' || event.key === 'Tab') {
          const item = items[selectedIndex];
          if (item) {
            command(item);
            return true;
          }
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="rounded-md border bg-popover p-3 shadow-lg">
          <p className="text-sm text-muted-foreground text-center">No users found</p>
        </div>
      );
    }

    return (
      <div className="rounded-md border bg-popover shadow-lg max-h-60 overflow-auto">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b">
          <User className="inline-block h-3 w-3 mr-1" />
          Mentions
        </div>
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              'flex w-full items-center gap-3 px-3 py-2 text-left',
              'hover:bg-accent focus:bg-accent focus:outline-none',
              index === selectedIndex && 'bg-accent'
            )}
            onClick={() => command(item)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            {item.avatar ? (
              <img src={item.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              {item.displayName && (
                <p className="truncate text-sm font-medium">{item.displayName}</p>
              )}
              <p className="truncate text-sm text-muted-foreground">@{item.label}</p>
            </div>
          </button>
        ))}
      </div>
    );
  }
);

MentionList.displayName = 'MentionList';

// =============================================================================
// TAG LIST
// =============================================================================

/**
 * Dropdown list for # tag suggestions.
 */
export const TagList = forwardRef<SuggestionListRef, SuggestionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: (event: KeyboardEvent): boolean => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
          return true;
        }

        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }

        if (event.key === 'Enter' || event.key === 'Tab') {
          const item = items[selectedIndex];
          if (item) {
            command(item);
            return true;
          }
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="rounded-md border bg-popover p-3 shadow-lg">
          <p className="text-sm text-muted-foreground text-center">Type a tag name</p>
        </div>
      );
    }

    return (
      <div className="rounded-md border bg-popover shadow-lg max-h-60 overflow-auto">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b">
          <Hash className="inline-block h-3 w-3 mr-1" />
          Tags
        </div>
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-left',
              'hover:bg-accent focus:bg-accent focus:outline-none',
              index === selectedIndex && 'bg-accent'
            )}
            onClick={() => command(item)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <Hash className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">#{item.label}</span>
          </button>
        ))}
      </div>
    );
  }
);

TagList.displayName = 'TagList';
