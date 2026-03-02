'use client';

/**
 * Structure step for the collection wizard.
 *
 * @remarks
 * Step 4: Subcollections, item ordering, and item assignment.
 *
 * @packageDocumentation
 */

import { useState, useCallback } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { X, GripVertical, FolderPlus, FileText } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { SortableItemList, type DragHandleProps } from '@/components/collection/sortable-item-list';
import { cn } from '@/lib/utils';

import type { CollectionFormValues, CollectionItemFormData } from './types';
import { ITEM_TYPE_CONFIG } from './types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for StepStructure component.
 */
export interface StepStructureProps {
  /** React Hook Form instance */
  form: UseFormReturn<CollectionFormValues>;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Structure step: subcollections, item ordering, and assignment.
 *
 * @param props - Component props
 * @returns Structure step element
 */
export function StepStructure({ form }: StepStructureProps) {
  const { setValue, watch } = form;
  const items = watch('items') ?? [];
  const subcollections = watch('subcollections') ?? [];

  const [newSubName, setNewSubName] = useState('');

  const addSubcollection = useCallback(() => {
    const trimmed = newSubName.trim();
    if (!trimmed) return;
    if (subcollections.some((s) => s.name === trimmed)) {
      toast.error('A subcollection with this name already exists.');
      return;
    }
    setValue('subcollections', [...subcollections, { name: trimmed, items: [] }], {
      shouldDirty: true,
    });
    setNewSubName('');
  }, [newSubName, subcollections, setValue]);

  const removeSubcollection = useCallback(
    (index: number) => {
      const updated = [...subcollections];
      updated.splice(index, 1);
      setValue('subcollections', updated, { shouldDirty: true });
    },
    [subcollections, setValue]
  );

  const assignItemToSubcollection = useCallback(
    (itemUri: string, subIndex: number | 'none') => {
      // Remove from all subcollections first
      const updated = subcollections.map((sub) => ({
        ...sub,
        items: sub.items.filter((uri) => uri !== itemUri),
      }));
      // Add to selected subcollection
      if (subIndex !== 'none' && typeof subIndex === 'number') {
        updated[subIndex] = {
          ...updated[subIndex],
          items: [...updated[subIndex].items, itemUri],
        };
      }
      setValue('subcollections', updated, { shouldDirty: true });
    },
    [subcollections, setValue]
  );

  /** Items with `id` field for SortableItemList compatibility. */
  const sortableItems = items.map((item, index) => ({
    ...item,
    id: `${item.uri}-${index}`,
  }));

  const handleReorder = useCallback(
    (reordered: Array<CollectionItemFormData & { id: string }>) => {
      // Strip the synthetic `id` before updating form values
      const updated: CollectionItemFormData[] = reordered.map(({ id: _id, ...rest }) => rest);
      setValue('items', updated, { shouldDirty: true });
    },
    [setValue]
  );

  const getSubcollectionForItem = useCallback(
    (itemUri: string): number | 'none' => {
      const idx = subcollections.findIndex((sub) => sub.items.includes(itemUri));
      return idx >= 0 ? idx : 'none';
    },
    [subcollections]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Structure</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create subcollections, reorder items, and assign items to subcollections.
        </p>
      </div>

      {/* Create subcollection */}
      <div className="space-y-2">
        <Label>Subcollections</Label>
        <div className="flex gap-2">
          <Input
            value={newSubName}
            onChange={(e) => setNewSubName(e.target.value)}
            placeholder="Subcollection name..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSubcollection();
              }
            }}
          />
          <Button type="button" onClick={addSubcollection} disabled={!newSubName.trim()}>
            <FolderPlus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
        {subcollections.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {subcollections.map((sub, index) => (
              <Badge key={sub.name} variant="secondary" className="gap-1 py-1 pl-2 pr-1">
                <FolderPlus className="h-3 w-3 text-muted-foreground" />
                <span>{sub.name}</span>
                <span className="text-[10px] text-muted-foreground ml-1">({sub.items.length})</span>
                <button
                  type="button"
                  onClick={() => removeSubcollection(index)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                  aria-label={`Remove ${sub.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Item ordering and subcollection assignment */}
      <div className="space-y-2">
        <Label>Item Order &amp; Assignment</Label>
        {items.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
            <p>No items to organize. Add items in the previous step.</p>
          </div>
        ) : (
          <SortableItemList
            items={sortableItems}
            onReorder={handleReorder}
            renderItem={(item, dragHandleProps: DragHandleProps) => {
              const config = ITEM_TYPE_CONFIG[item.type] ?? {
                label: item.type,
                icon: FileText,
                color: 'bg-gray-100 text-gray-800',
              };
              const Icon = config.icon;

              return (
                <Card>
                  <CardContent className="flex items-center gap-3 p-3">
                    {/* Drag handle */}
                    <button
                      type="button"
                      className="cursor-grab touch-none p-0.5 text-muted-foreground hover:text-foreground"
                      ref={dragHandleProps.ref}
                      {...(dragHandleProps.attributes as React.HTMLAttributes<HTMLButtonElement>)}
                      {...(dragHandleProps.listeners as React.HTMLAttributes<HTMLButtonElement>)}
                      aria-label="Drag to reorder"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>

                    {/* Item info */}
                    <Badge variant="outline" className={cn('shrink-0 gap-1', config.color)}>
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                    <span className="text-sm font-medium truncate flex-1 min-w-0">
                      {item.label}
                    </span>

                    {/* Subcollection assignment */}
                    {subcollections.length > 0 && (
                      <Select
                        value={String(getSubcollectionForItem(item.uri))}
                        onValueChange={(val) => {
                          assignItemToSubcollection(
                            item.uri,
                            val === 'none' ? 'none' : Number(val)
                          );
                        }}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="No subcollection" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No subcollection</SelectItem>
                          {subcollections.map((sub, subIdx) => (
                            <SelectItem key={sub.name} value={String(subIdx)}>
                              {sub.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </CardContent>
                </Card>
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
