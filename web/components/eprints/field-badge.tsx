'use client';

import { useState } from 'react';
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
  // `Badge` does not set `whitespace-nowrap`, so a long field label — and
  // discipline labels are long — wrapped inside the pill on a narrow screen.
  // The result was a two-line chip whose `py-0.5` padding was sized for one
  // line, which is what made a row of field chips look broken on a phone. A
  // chip is now always one line, truncating at the container's width, with the
  // full label available to assistive technology and on hover.
  const badge = (
    <Badge
      variant={variant}
      title={field.label}
      className={cn(
        'max-w-full truncate whitespace-nowrap py-1',
        clickable && 'cursor-pointer hover:bg-secondary/60',
        className
      )}
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
  const [expanded, setExpanded] = useState(false);

  if (!fields || fields.length === 0) {
    return null;
  }

  const visibleFields = expanded ? fields : fields.slice(0, max);
  const hiddenCount = expanded ? 0 : fields.length - max;

  return (
    // `gap-1` put 4px between tappable chips, which on a touch screen means
    // neighbouring links are easy to hit by mistake.
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {visibleFields.map((field) => (
        <FieldBadge
          key={field.uri ?? field.id}
          field={field}
          variant={variant}
          clickable={clickable}
        />
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={`Show ${String(hiddenCount)} more field${hiddenCount === 1 ? '' : 's'}`}
        >
          <Badge
            variant="outline"
            className="cursor-pointer whitespace-nowrap py-1 text-muted-foreground hover:bg-accent"
          >
            +{hiddenCount} more
          </Badge>
        </button>
      )}
    </div>
  );
}
