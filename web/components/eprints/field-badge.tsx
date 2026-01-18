import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FieldRef } from '@/lib/api/schema';

export type { FieldRef };

/**
 * Props for the FieldBadge component.
 */
export interface FieldBadgeProps {
  /** Field reference data */
  field: FieldRef;
  /** Badge variant */
  variant?: 'default' | 'secondary' | 'outline';
  /** Whether the badge is clickable */
  clickable?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a field as a badge with optional link to field page.
 */
export function FieldBadge({
  field,
  variant = 'secondary',
  clickable = true,
  className,
}: FieldBadgeProps) {
  const badge = (
    <Badge
      variant={variant}
      className={cn(clickable && 'cursor-pointer hover:bg-secondary/60', className)}
    >
      {field.label}
    </Badge>
  );

  if (!clickable) {
    return badge;
  }

  const fieldId = field.uri ?? field.id ?? '';
  return (
    <Link href={`/fields/${encodeURIComponent(fieldId)}`} className="inline-block">
      {badge}
    </Link>
  );
}

/**
 * Props for the FieldBadgeList component.
 */
export interface FieldBadgeListProps {
  /** Array of field references */
  fields: FieldRef[];
  /** Maximum number of fields to show */
  max?: number;
  /** Badge variant */
  variant?: 'default' | 'secondary' | 'outline';
  /** Whether badges are clickable */
  clickable?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a list of field badges with optional truncation.
 */
export function FieldBadgeList({
  fields,
  max = 5,
  variant = 'secondary',
  clickable = true,
  className,
}: FieldBadgeListProps) {
  if (!fields || fields.length === 0) {
    return null;
  }

  const visibleFields = fields.slice(0, max);
  const hiddenCount = fields.length - max;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {visibleFields.map((field) => (
        <FieldBadge
          key={field.uri ?? field.id}
          field={field}
          variant={variant}
          clickable={clickable}
        />
      ))}
      {hiddenCount > 0 && (
        <Badge variant="outline" className="text-muted-foreground">
          +{hiddenCount} more
        </Badge>
      )}
    </div>
  );
}
