'use client';

/**
 * Reusable sortable list component with drag-and-drop reordering.
 *
 * @remarks
 * Uses @dnd-kit for accessible, performant drag-and-drop sorting.
 * Supports both vertical list and grid layouts. Each item receives
 * drag handle props that the consumer attaches to a handle element
 * (typically a GripVertical icon).
 *
 * @example
 * ```tsx
 * <SortableItemList
 *   items={collectionItems}
 *   onReorder={setItems}
 *   renderItem={(item, dragHandleProps) => (
 *     <div className="flex items-center gap-2">
 *       <button {...dragHandleProps.attributes} {...dragHandleProps.listeners} ref={dragHandleProps.ref}>
 *         <GripVertical className="h-4 w-4" />
 *       </button>
 *       <span>{item.label}</span>
 *     </div>
 *   )}
 * />
 * ```
 */

import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props passed to the drag handle element within each sortable item.
 *
 * @remarks
 * The consumer should spread `attributes` and `listeners` onto the handle
 * element and assign `ref` to it. This allows the drag interaction to be
 * initiated only from the handle rather than the entire item.
 */
export interface DragHandleProps {
  /** Ref callback for the drag activator element */
  ref: (element: HTMLElement | null) => void;
  /** ARIA and data attributes for accessibility */
  attributes: Record<string, unknown>;
  /** Pointer and keyboard event listeners for drag initiation */
  listeners: Record<string, unknown> | undefined;
}

/**
 * Props for the SortableItemList component.
 *
 * @typeParam T - the item type, which must have a string `id` property
 */
export interface SortableItemListProps<T extends { id: string }> {
  /** Items to render in sortable order */
  items: T[];
  /** Callback invoked with the reordered items after a drag-drop operation */
  onReorder: (items: T[]) => void;
  /** Render function for each item; receives the item and drag handle props */
  renderItem: (item: T, dragHandleProps: DragHandleProps) => React.ReactNode;
  /** Layout mode: vertical list or grid (defaults to 'vertical') */
  layout?: 'vertical' | 'grid';
  /** Whether drag-and-drop is disabled */
  disabled?: boolean;
  /** Additional CSS class names for the container */
  className?: string;
}

// =============================================================================
// SORTABLE ITEM WRAPPER
// =============================================================================

/**
 * Props for the internal SortableItem wrapper component.
 */
interface SortableItemProps<T extends { id: string }> {
  item: T;
  renderItem: (item: T, dragHandleProps: DragHandleProps) => React.ReactNode;
  disabled?: boolean;
}

/**
 * Wraps an individual item with useSortable hook for drag-and-drop.
 *
 * @remarks
 * Applies transform and transition CSS from dnd-kit. The drag handle props
 * are forwarded to the consumer's renderItem function so the handle can be
 * placed on a specific element (e.g., a grip icon).
 */
function SortableItem<T extends { id: string }>({
  item,
  renderItem,
  disabled,
}: SortableItemProps<T>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 10 : undefined,
  };

  const dragHandleProps: DragHandleProps = {
    ref: setActivatorNodeRef,
    attributes: attributes as unknown as Record<string, unknown>,
    listeners: listeners as unknown as Record<string, unknown> | undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="h-full">
      {renderItem(item, dragHandleProps)}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Renders a list of items that can be reordered via drag-and-drop.
 *
 * @remarks
 * Uses @dnd-kit/core DndContext and @dnd-kit/sortable SortableContext to
 * provide accessible drag-and-drop sorting. Supports pointer and keyboard
 * sensors. The sorting strategy is chosen based on the `layout` prop:
 * `verticalListSortingStrategy` for vertical lists and `rectSortingStrategy`
 * for grid layouts.
 *
 * The `renderItem` callback receives `DragHandleProps` that should be
 * applied to a dedicated handle element (e.g., a GripVertical icon button).
 * This prevents accidental drags when interacting with other parts of the
 * item.
 *
 * @typeParam T - the item type, which must have a string `id` property
 *
 * @param props - component props
 * @returns the sortable list element
 *
 * @example
 * ```tsx
 * import { GripVertical } from 'lucide-react';
 * import { SortableItemList } from '@/components/collection/sortable-item-list';
 *
 * function MyList({ items, onReorder }) {
 *   return (
 *     <SortableItemList
 *       items={items}
 *       onReorder={onReorder}
 *       renderItem={(item, dragHandleProps) => (
 *         <Card className="flex items-center gap-2 p-3">
 *           <button
 *             className="cursor-grab touch-none"
 *             ref={dragHandleProps.ref}
 *             {...dragHandleProps.attributes}
 *             {...dragHandleProps.listeners}
 *           >
 *             <GripVertical className="h-4 w-4 text-muted-foreground" />
 *           </button>
 *           <span>{item.label}</span>
 *         </Card>
 *       )}
 *     />
 *   );
 * }
 * ```
 */
export function SortableItemList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  layout = 'vertical',
  disabled = false,
  className,
}: SortableItemListProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);

  const strategy = layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy;

  const activeItem = useMemo(
    () => (activeId ? (items.find((item) => item.id === activeId) ?? null) : null),
    [activeId, items]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);

      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((item) => item.id === String(active.id));
      const newIndex = items.findIndex((item) => item.id === String(over.id));

      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(items, oldIndex, newIndex);
      onReorder(reordered);
    },
    [items, onReorder]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const containerClassName = cn(
    layout === 'grid' ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col gap-2',
    className
  );

  /** No-op drag handle props for the overlay item (not interactive). */
  const overlayDragHandleProps: DragHandleProps = {
    ref: () => {},
    attributes: {},
    listeners: undefined,
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={itemIds} strategy={strategy}>
        <div className={containerClassName} role="list">
          {items.map((item) => (
            <SortableItem key={item.id} item={item} renderItem={renderItem} disabled={disabled} />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeItem ? (
          <div className="opacity-90 shadow-lg rounded-lg">
            {renderItem(activeItem, overlayDragHandleProps)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
