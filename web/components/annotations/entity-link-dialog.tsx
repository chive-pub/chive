'use client';

/**
 * Dialog for linking a text span to an entity (Wikidata or authority).
 *
 * @example
 * ```tsx
 * <EntityLinkDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   selectedText="neural networks"
 *   onLink={handleLink}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback } from 'react';
import { Link2, ExternalLink, BookOpen, Search } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { WikidataSearch, type WikidataEntity } from './wikidata-search';
import { AuthoritySearch, type AuthorityResult } from './authority-search';
import type { EntityLinkType } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for EntityLinkDialog.
 */
export interface EntityLinkDialogProps {
  /** Dialog open state */
  open: boolean;

  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;

  /** The selected text to link */
  selectedText: string;

  /** Callback when entity is linked */
  onLink: (entity: EntityLinkType) => void;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Dialog for linking text spans to entities.
 *
 * @param props - Component props
 * @returns Dialog element
 */
export function EntityLinkDialog({
  open,
  onOpenChange,
  selectedText,
  onLink,
  className,
}: EntityLinkDialogProps) {
  const [query, setQuery] = useState(selectedText);
  const [selectedEntity, setSelectedEntity] = useState<WikidataEntity | AuthorityResult | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<'wikidata' | 'authority'>('wikidata');

  // Reset state when dialog opens
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen) {
        setQuery(selectedText);
        setSelectedEntity(null);
      }
      onOpenChange(newOpen);
    },
    [selectedText, onOpenChange]
  );

  const handleWikidataSelect = useCallback((entity: WikidataEntity) => {
    setSelectedEntity(entity);
  }, []);

  const handleAuthoritySelect = useCallback((authority: AuthorityResult) => {
    setSelectedEntity(authority);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selectedEntity) return;

    // Convert to EntityLinkType
    if ('qid' in selectedEntity) {
      // Wikidata entity
      onLink({
        type: 'wikidata',
        qid: selectedEntity.qid,
        label: selectedEntity.label,
        url: selectedEntity.url,
      });
    } else {
      // Authority record
      onLink({
        type: 'authority',
        uri: selectedEntity.uri,
        authorizedForm: selectedEntity.authorizedForm,
        variantForms: selectedEntity.variantForms,
      });
    }

    onOpenChange(false);
  }, [selectedEntity, onLink, onOpenChange]);

  const isWikidataEntity = selectedEntity && 'qid' in selectedEntity;
  const isAuthority = selectedEntity && 'authorizedForm' in selectedEntity;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn('sm:max-w-lg', className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Link to entity
          </DialogTitle>
          <DialogDescription>
            Link &quot;{selectedText}&quot; to a knowledge graph entity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search input */}
          <div className="space-y-2">
            <Label htmlFor="entity-search">Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="entity-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search entities..."
                className="pl-9"
              />
            </div>
          </div>

          {/* Tabs for Wikidata vs Authority */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'wikidata' | 'authority')}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="wikidata" className="gap-1">
                <ExternalLink className="h-3 w-3" />
                Wikidata
              </TabsTrigger>
              <TabsTrigger value="authority" className="gap-1">
                <BookOpen className="h-3 w-3" />
                Authorities
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="wikidata"
              className="mt-4 max-h-[250px] overflow-y-auto border rounded-md"
            >
              <WikidataSearch query={query} onSelect={handleWikidataSelect} />
            </TabsContent>

            <TabsContent
              value="authority"
              className="mt-4 max-h-[250px] overflow-y-auto border rounded-md"
            >
              <AuthoritySearch query={query} onSelect={handleAuthoritySelect} />
            </TabsContent>
          </Tabs>

          {/* Selection preview */}
          {selectedEntity && (
            <div className="rounded-md border bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Selected:</p>
              <div className="flex items-center gap-2">
                {isWikidataEntity && (
                  <>
                    <Badge
                      variant="secondary"
                      className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                    >
                      {selectedEntity.qid}
                    </Badge>
                    <span className="font-medium">{selectedEntity.label}</span>
                  </>
                )}
                {isAuthority && (
                  <>
                    <Badge
                      variant="secondary"
                      className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                    >
                      Authority
                    </Badge>
                    <span className="font-medium">{selectedEntity.authorizedForm}</span>
                  </>
                )}
              </div>
              {isWikidataEntity && selectedEntity.description && (
                <p className="text-xs text-muted-foreground mt-1">{selectedEntity.description}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedEntity}
            className="gap-2"
          >
            <Link2 className="h-4 w-4" />
            Link entity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
