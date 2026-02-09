'use client';

/**
 * Cross-reference suggestion list for [[ autocomplete.
 *
 * @remarks
 * Provides a dropdown UI for cross-referencing reviews and annotations
 * within the current eprint. Follows the same pattern as MentionList/TagList.
 *
 * @packageDocumentation
 */

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { MessageSquare, FileText } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { SuggestionListRef } from './suggestion-list';

// =============================================================================
// TYPES
// =============================================================================

/**
 * A cross-reference suggestion item.
 */
export interface CrossReferenceItem {
  /** AT-URI of the review or annotation */
  uri: string;
  /** Display label (author handle or name) */
  label: string;
  /** Whether this is a review or annotation */
  type: 'review' | 'annotation';
  /** Truncated content preview */
  contentPreview: string;
}

/**
 * Props for CrossReferenceList component.
 */
export interface CrossReferenceListProps {
  /** Available items to display */
  items: CrossReferenceItem[];
  /** Callback when item is selected */
  command: (item: CrossReferenceItem) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Dropdown list for [[ cross-reference suggestions.
 */
export const CrossReferenceList = forwardRef<SuggestionListRef, CrossReferenceListProps>(
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
          <p className="text-sm text-muted-foreground text-center">
            No reviews or annotations found
          </p>
        </div>
      );
    }

    const reviews = items.filter((item) => item.type === 'review');
    const annotations = items.filter((item) => item.type === 'annotation');

    return (
      <div className="rounded-md border bg-popover text-popover-foreground shadow-lg max-h-60 overflow-auto overscroll-contain">
        {/* Reviews section */}
        {reviews.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b">
              <FileText className="inline-block h-3 w-3 mr-1" />
              Reviews
            </div>
            {reviews.map((item) => {
              const itemIndex = items.indexOf(item);
              return (
                <button
                  key={item.uri}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2 text-left',
                    'hover:bg-accent focus:bg-accent focus:outline-none',
                    itemIndex === selectedIndex && 'bg-accent'
                  )}
                  onClick={() => command(item)}
                  onMouseEnter={() => setSelectedIndex(itemIndex)}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-muted">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium">{item.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.contentPreview}</p>
                  </div>
                </button>
              );
            })}
          </>
        )}

        {/* Annotations section */}
        {annotations.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b">
              <MessageSquare className="inline-block h-3 w-3 mr-1" />
              Annotations
            </div>
            {annotations.map((item) => {
              const itemIndex = items.indexOf(item);
              return (
                <button
                  key={item.uri}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2 text-left',
                    'hover:bg-accent focus:bg-accent focus:outline-none',
                    itemIndex === selectedIndex && 'bg-accent'
                  )}
                  onClick={() => command(item)}
                  onMouseEnter={() => setSelectedIndex(itemIndex)}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-muted">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium">{item.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.contentPreview}</p>
                  </div>
                </button>
              );
            })}
          </>
        )}
      </div>
    );
  }
);

CrossReferenceList.displayName = 'CrossReferenceList';
