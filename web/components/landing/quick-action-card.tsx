import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface QuickActionCardProps {
  /** Link destination */
  href: string;
  /** Icon component */
  icon: LucideIcon;
  /** Card title */
  label: string;
  /** Optional description */
  description?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Quick action card for authenticated user dashboard.
 *
 * @remarks
 * Provides fast access to common actions from the landing page.
 * Only shown to authenticated users.
 */
export function QuickActionCard({
  href,
  icon: Icon,
  label,
  description,
  className,
}: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex flex-col items-center gap-2 rounded-lg border bg-card p-4 text-center transition-colors hover:bg-accent hover:text-accent-foreground',
        className
      )}
    >
      <div className="rounded-full bg-muted p-3 group-hover:bg-background transition-colors">
        <Icon className="h-6 w-6" />
      </div>
      <span className="font-medium">{label}</span>
      {description && <span className="text-xs text-muted-foreground">{description}</span>}
    </Link>
  );
}
