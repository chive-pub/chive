'use client';

/**
 * Semble integration step for the collection wizard.
 *
 * @remarks
 * Step 5: Toggle Semble mirroring and preview what will be created.
 *
 * @packageDocumentation
 */

import type { UseFormReturn } from 'react-hook-form';
import { FileText } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import type { CollectionFormValues } from './types';
import { ITEM_TYPE_CONFIG } from './types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for StepCosmik component.
 */
export interface StepCosmikProps {
  /** React Hook Form instance */
  form: UseFormReturn<CollectionFormValues>;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Semble integration step: toggle mirroring and preview.
 *
 * @param props - Component props
 * @returns Cosmik step element
 */
export function StepCosmik({ form }: StepCosmikProps) {
  const { setValue, watch } = form;
  const enableCosmikMirror = watch('enableCosmikMirror');
  const name = watch('name');
  const description = watch('description');
  const visibility = watch('visibility');
  const items = watch('items') ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Semble Integration</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Optionally mirror this collection on Semble for broader discovery.
        </p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="cosmik-mirror"
              checked={enableCosmikMirror}
              onCheckedChange={(checked) => {
                setValue('enableCosmikMirror', !!checked, { shouldDirty: true });
              }}
            />
            <div className="space-y-1">
              <Label htmlFor="cosmik-mirror" className="cursor-pointer">
                Mirror this collection on Semble
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, a Semble reading list will be created with the same items. Changes to
                this collection will be synced.
              </p>
            </div>
          </div>

          {enableCosmikMirror && (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <h4 className="text-sm font-medium">Semble Mirror Preview</h4>

                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Collection title:</span>{' '}
                    <span className="font-medium">{name || 'Untitled'}</span>
                  </div>
                  {description && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Description:</span>{' '}
                      <span>{description}</span>
                    </div>
                  )}
                  <div className="text-sm">
                    <span className="text-muted-foreground">Visibility:</span>{' '}
                    <Badge variant="outline" className="capitalize text-xs">
                      {visibility}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Semble cards to create:</span>{' '}
                    <span className="font-medium">
                      {items.length} card{items.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {items.length > 0 ? (
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {items.map((item, index) => {
                        const config = ITEM_TYPE_CONFIG[item.type] ?? {
                          label: item.type,
                          icon: FileText,
                          color: 'bg-gray-100 text-gray-800',
                        };
                        const Icon = config.icon;

                        return (
                          <div
                            key={`${item.uri}-${index}`}
                            className="flex items-center gap-2 text-xs py-1"
                          >
                            <Badge
                              variant="outline"
                              className={cn('shrink-0 gap-0.5 text-[10px] px-1', config.color)}
                            >
                              <Icon className="h-2.5 w-2.5" />
                              {config.label}
                            </Badge>
                            <span className="truncate">{item.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No items to mirror. Add items in the Items step first.
                    </p>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Items will be mirrored as{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                  network.cosmik.card
                </code>{' '}
                records and grouped into a{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                  network.cosmik.collection
                </code>{' '}
                in your PDS.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
