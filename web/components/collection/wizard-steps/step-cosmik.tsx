'use client';

/**
 * Semble integration step for the collection wizard.
 *
 * @remarks
 * Step 5: Toggle Semble mirroring, configure collaborators, edge sync,
 * and preview what will be created.
 *
 * @packageDocumentation
 */

import { useState, useCallback } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { FileText, X, Plus, Link2, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
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
 * Semble integration step: toggle mirroring, collaborators, edge sync, and preview.
 *
 * @param props - Component props
 * @returns Cosmik step element
 */
export function StepCosmik({ form }: StepCosmikProps) {
  const { setValue, watch } = form;
  const enableCosmikMirror = watch('enableCosmikMirror');
  const syncEdgesAsConnections = watch('syncEdgesAsConnections');
  const cosmikCollaborators = watch('cosmikCollaborators') ?? [];
  const name = watch('name');
  const description = watch('description');
  const visibility = watch('visibility');
  const items = watch('items') ?? [];
  const edges = watch('edges') ?? [];

  const [newCollaboratorDid, setNewCollaboratorDid] = useState('');

  const addCollaborator = useCallback(() => {
    const did = newCollaboratorDid.trim();
    if (!did || !did.startsWith('did:')) return;
    if (cosmikCollaborators.includes(did)) return;

    setValue('cosmikCollaborators', [...cosmikCollaborators, did], { shouldDirty: true });
    setNewCollaboratorDid('');
  }, [newCollaboratorDid, cosmikCollaborators, setValue]);

  const removeCollaborator = useCallback(
    (did: string) => {
      setValue(
        'cosmikCollaborators',
        cosmikCollaborators.filter((d) => d !== did),
        { shouldDirty: true }
      );
    },
    [cosmikCollaborators, setValue]
  );

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
              {/* Edge sync toggle */}
              {edges.length > 0 && (
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="sync-edges"
                    checked={syncEdgesAsConnections}
                    onCheckedChange={(checked) => {
                      setValue('syncEdgesAsConnections', !!checked, { shouldDirty: true });
                    }}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="sync-edges" className="cursor-pointer flex items-center gap-1">
                      <Link2 className="h-3.5 w-3.5" />
                      Sync edges as Semble connections
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Mirror {edges.length} edge{edges.length !== 1 ? 's' : ''} as{' '}
                      <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                        network.cosmik.connection
                      </code>{' '}
                      records so relationships are visible in Semble.
                    </p>
                  </div>
                </div>
              )}

              {/* Collaborators section */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  Collaborators
                </Label>
                <p className="text-xs text-muted-foreground">
                  Add DIDs of users who can contribute to this collection on Semble.
                </p>

                {cosmikCollaborators.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {cosmikCollaborators.map((did) => (
                      <Badge key={did} variant="secondary" className="gap-1 py-0.5 pl-2 pr-1">
                        <span className="text-[10px] font-mono truncate max-w-[200px]">{did}</span>
                        <button
                          type="button"
                          onClick={() => removeCollaborator(did)}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                          aria-label={`Remove collaborator ${did}`}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCollaboratorDid}
                    onChange={(e) => setNewCollaboratorDid(e.target.value)}
                    placeholder="did:plc:..."
                    className="flex h-8 flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-xs font-mono"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCollaborator();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addCollaborator}
                    disabled={!newCollaboratorDid.trim().startsWith('did:')}
                    className="h-8"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Mirror preview */}
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
                  {cosmikCollaborators.length > 0 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Collaborators:</span>{' '}
                      <span className="font-medium">{cosmikCollaborators.length}</span>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Semble cards to create:</span>{' '}
                    <span className="font-medium">
                      {items.length} card{items.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {syncEdgesAsConnections && edges.length > 0 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Connections to create:</span>{' '}
                      <span className="font-medium">
                        {edges.length} connection{edges.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}

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
                </code>
                {syncEdgesAsConnections && edges.length > 0 && (
                  <>
                    {' '}
                    with edges as{' '}
                    <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                      network.cosmik.connection
                    </code>
                  </>
                )}{' '}
                in your PDS.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
