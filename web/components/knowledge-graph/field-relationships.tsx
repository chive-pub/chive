import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight, ArrowRight, Equal, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FieldRelationship } from '@/lib/api/schema';

export type { FieldRelationship };

/**
 * Relationship type for field connections.
 */
export type FieldRelationType = FieldRelationship['type'];

/**
 * Props for the FieldRelationships component.
 */
export interface FieldRelationshipsProps {
  /** Array of field relationships */
  relationships: FieldRelationship[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays related fields grouped by relationship type.
 */
export function FieldRelationships({ relationships, className }: FieldRelationshipsProps) {
  if (!relationships || relationships.length === 0) {
    return null;
  }

  const grouped = groupRelationships(relationships);

  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Related Fields
      </h3>

      <div className="space-y-4">
        {grouped.broader.length > 0 && (
          <RelationshipGroup
            type="broader"
            label="Broader Terms"
            icon={<ArrowUpRight className="h-4 w-4" />}
            relationships={grouped.broader}
          />
        )}

        {grouped.narrower.length > 0 && (
          <RelationshipGroup
            type="narrower"
            label="Narrower Terms"
            icon={<ArrowDownRight className="h-4 w-4" />}
            relationships={grouped.narrower}
          />
        )}

        {grouped.related.length > 0 && (
          <RelationshipGroup
            type="related"
            label="Related Terms"
            icon={<ArrowRight className="h-4 w-4" />}
            relationships={grouped.related}
          />
        )}

        {grouped.equivalent.length > 0 && (
          <RelationshipGroup
            type="equivalent"
            label="Equivalent Terms"
            icon={<Equal className="h-4 w-4" />}
            relationships={grouped.equivalent}
          />
        )}

        {grouped.influences.length > 0 && (
          <RelationshipGroup
            type="influences"
            label="Influences"
            icon={<Sparkles className="h-4 w-4" />}
            relationships={grouped.influences}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Props for the RelationshipGroup component.
 */
interface RelationshipGroupProps {
  type: FieldRelationType;
  label: string;
  icon: React.ReactNode;
  relationships: FieldRelationship[];
}

/**
 * Group of relationships with the same type.
 */
function RelationshipGroup({ type: _type, label, icon, relationships }: RelationshipGroupProps) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        {label}
      </h4>
      <ul className="space-y-1">
        {relationships.map((rel) => (
          <li key={rel.targetId}>
            <Link
              href={`/fields/${encodeURIComponent(rel.targetId)}`}
              className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-accent"
            >
              <span>{rel.targetLabel}</span>
              {rel.strength !== undefined && <StrengthIndicator strength={rel.strength} />}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Props for the StrengthIndicator component.
 */
interface StrengthIndicatorProps {
  strength: number;
}

/**
 * Visual indicator of relationship strength.
 */
function StrengthIndicator({ strength }: StrengthIndicatorProps) {
  const percent = Math.round(strength * 100);
  const level = strength >= 0.8 ? 'high' : strength >= 0.5 ? 'medium' : 'low';

  const colors = {
    high: 'bg-green-500',
    medium: 'bg-yellow-500',
    low: 'bg-gray-400',
  };

  return (
    <div className="flex items-center gap-1">
      <div className="h-1.5 w-8 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', colors[level])}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{percent}%</span>
    </div>
  );
}

/**
 * Groups relationships by type.
 */
function groupRelationships(
  relationships: FieldRelationship[]
): Record<FieldRelationType, FieldRelationship[]> {
  return {
    broader: relationships.filter((r) => r.type === 'broader'),
    narrower: relationships.filter((r) => r.type === 'narrower'),
    related: relationships.filter((r) => r.type === 'related'),
    equivalent: relationships.filter((r) => r.type === 'equivalent'),
    influences: relationships.filter((r) => r.type === 'influences'),
  };
}

/**
 * Props for the RelatedFieldBadges component.
 */
export interface RelatedFieldBadgesProps {
  /** Array of field relationships */
  relationships: FieldRelationship[];
  /** Maximum badges to show */
  max?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Compact display of related fields as badges.
 */
export function RelatedFieldBadges({ relationships, max = 5, className }: RelatedFieldBadgesProps) {
  if (!relationships || relationships.length === 0) {
    return null;
  }

  const visible = relationships.slice(0, max);
  const hiddenCount = relationships.length - max;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {visible.map((rel) => (
        <Link key={rel.targetId} href={`/fields/${encodeURIComponent(rel.targetId)}`}>
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-accent"
            title={`${rel.type}: ${rel.targetLabel}`}
          >
            {rel.targetLabel}
          </Badge>
        </Link>
      ))}
      {hiddenCount > 0 && (
        <Badge variant="outline" className="text-muted-foreground">
          +{hiddenCount} more
        </Badge>
      )}
    </div>
  );
}

/**
 * Props for the FieldRelationshipsSkeleton component.
 */
export interface FieldRelationshipsSkeletonProps {
  groups?: number;
  itemsPerGroup?: number;
  className?: string;
}

/**
 * Loading skeleton for FieldRelationships.
 */
export function FieldRelationshipsSkeleton({
  groups = 2,
  itemsPerGroup = 3,
  className,
}: FieldRelationshipsSkeletonProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      {Array.from({ length: groups }).map((_, i) => (
        <div key={i}>
          <div className="mb-2 h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="space-y-1">
            {Array.from({ length: itemsPerGroup }).map((_, j) => (
              <div key={j} className="h-8 w-full animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
