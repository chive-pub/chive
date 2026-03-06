import Link from 'next/link';
import { Globe, Link as LinkIcon, FolderOpen, Hash } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatRelativeDate } from '@/lib/utils/format-date';

/**
 * Props for the CollectionCard component.
 */
interface CollectionCardProps {
  uri: string;
  name: string;
  description?: string;
  itemCount: number;
  visibility: 'listed' | 'unlisted';
  tags?: string[];
  ownerDid?: string;
  ownerHandle?: string;
  createdAt: string;
  subcollectionCount?: number;
  className?: string;
}

/**
 * Visibility icon and label mapping.
 */
const VISIBILITY_CONFIG = {
  listed: { icon: Globe, label: 'Listed' },
  unlisted: { icon: LinkIcon, label: 'Unlisted' },
} as const;

/**
 * Card component for displaying a collection summary.
 *
 * @remarks
 * Shows the collection name, description, item/subcollection counts,
 * visibility indicator, tags, and creation date. Clicking the card
 * navigates to the collection detail page.
 */
export function CollectionCard({
  uri,
  name,
  description,
  itemCount,
  visibility,
  tags,
  ownerHandle,
  createdAt,
  subcollectionCount,
  className,
}: CollectionCardProps) {
  const VisibilityIcon = VISIBILITY_CONFIG[visibility].icon;
  const visibilityLabel = VISIBILITY_CONFIG[visibility].label;

  return (
    <Link href={`/collections/${encodeURIComponent(uri)}`} className="block">
      <Card className={cn('transition-colors hover:bg-muted/50', className)}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base line-clamp-1">{name}</CardTitle>
            <div
              className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0"
              title={visibilityLabel}
            >
              <VisibilityIcon className="h-3.5 w-3.5" />
              <span className="sr-only">{visibilityLabel}</span>
            </div>
          </div>
          {description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Badge>
            {subcollectionCount != null && subcollectionCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                <FolderOpen className="mr-1 h-3 w-3" />
                {subcollectionCount} {subcollectionCount === 1 ? 'subcollection' : 'subcollections'}
              </Badge>
            )}
          </div>

          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs font-normal">
                  <Hash className="mr-0.5 h-2.5 w-2.5" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {ownerHandle && <span>@{ownerHandle}</span>}
            <span className={ownerHandle ? '' : 'ml-auto'}>{formatRelativeDate(createdAt)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
