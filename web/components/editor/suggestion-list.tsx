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
import Image from 'next/image';
import { User, Hash, Building2, FileText, Tag, Network, Layers } from 'lucide-react';

import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Item type for categorization in autocomplete.
 */
export type SuggestionItemType = 'user' | 'node' | 'tag';

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
  /** Item type for categorization */
  itemType?: SuggestionItemType;
  /** Node kind (type or object) for graph nodes */
  kind?: 'type' | 'object';
  /** Subkind slug for graph nodes */
  subkind?: string;
  /** AT-URI for graph nodes */
  uri?: string;
  /** Description for graph nodes */
  description?: string;
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
 * Gets the appropriate icon for a graph node based on its subkind.
 */
function getNodeIcon(subkind?: string) {
  switch (subkind) {
    case 'institution':
      return Building2;
    case 'field':
      return Layers;
    case 'facet':
      return Network;
    default:
      return FileText;
  }
}

/**
 * Gets a human-readable label for a subkind.
 */
function getSubkindLabel(subkind?: string): string {
  const labels: Record<string, string> = {
    institution: 'Institution',
    field: 'Field',
    facet: 'Facet',
    journal: 'Journal',
    conference: 'Conference',
    funder: 'Funder',
    license: 'License',
    'document-format': 'Format',
  };
  return subkind ? (labels[subkind] ?? subkind) : 'Node';
}

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
          <p className="text-sm text-muted-foreground text-center">No results found</p>
        </div>
      );
    }

    // Group items by type
    const users = items.filter((item) => item.itemType === 'user');
    const nodes = items.filter((item) => item.itemType === 'node');

    return (
      <div className="rounded-md border bg-popover text-popover-foreground shadow-lg max-h-60 overflow-auto overscroll-contain">
        {/* Users section */}
        {users.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b">
              <User className="inline-block h-3 w-3 mr-1" />
              Users
            </div>
            {users.map((item) => {
              const itemIndex = items.indexOf(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2 text-left',
                    'hover:bg-accent focus:bg-accent focus:outline-none',
                    itemIndex === selectedIndex && 'bg-accent'
                  )}
                  onClick={() => command(item)}
                  onMouseEnter={() => setSelectedIndex(itemIndex)}
                >
                  {item.avatar ? (
                    <Image
                      src={item.avatar}
                      alt=""
                      width={32}
                      height={32}
                      className="rounded-full object-cover"
                    />
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
              );
            })}
          </>
        )}

        {/* Nodes section */}
        {nodes.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b">
              <FileText className="inline-block h-3 w-3 mr-1" />
              Knowledge Graph
            </div>
            {nodes.map((item) => {
              const itemIndex = items.indexOf(item);
              const NodeIcon = getNodeIcon(item.subkind);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2 text-left',
                    'hover:bg-accent focus:bg-accent focus:outline-none',
                    itemIndex === selectedIndex && 'bg-accent'
                  )}
                  onClick={() => command(item)}
                  onMouseEnter={() => setSelectedIndex(itemIndex)}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <NodeIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium">{item.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {getSubkindLabel(item.subkind)}
                      {item.description && ` - ${item.description}`}
                    </p>
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
          <p className="text-sm text-muted-foreground text-center">
            Type to search fields and tags
          </p>
        </div>
      );
    }

    // Group items by type
    const nodes = items.filter((item) => item.itemType === 'node');
    const tags = items.filter((item) => item.itemType === 'tag' || !item.itemType);

    return (
      <div className="rounded-md border bg-popover text-popover-foreground shadow-lg max-h-60 overflow-auto overscroll-contain">
        {/* Type nodes section (fields, facets, etc.) */}
        {nodes.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b">
              <Layers className="inline-block h-3 w-3 mr-1" />
              Fields & Topics
            </div>
            {nodes.map((item) => {
              const itemIndex = items.indexOf(item);
              const NodeIcon = getNodeIcon(item.subkind);
              return (
                <button
                  key={item.id}
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
                    <NodeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium">{item.label}</p>
                    {item.description && (
                      <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </>
        )}

        {/* Plain tags section */}
        {tags.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b">
              <Tag className="inline-block h-3 w-3 mr-1" />
              Tags
            </div>
            {tags.map((item) => {
              const itemIndex = items.indexOf(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left',
                    'hover:bg-accent focus:bg-accent focus:outline-none',
                    itemIndex === selectedIndex && 'bg-accent'
                  )}
                  onClick={() => command(item)}
                  onMouseEnter={() => setSelectedIndex(itemIndex)}
                >
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">#{item.label}</span>
                </button>
              );
            })}
          </>
        )}
      </div>
    );
  }
);

TagList.displayName = 'TagList';
