/**
 * Page header component for consistent page titles.
 *
 * @remarks
 * Provides a standardized header layout with:
 * - Title and optional description
 * - Optional action buttons
 * - Responsive layout
 *
 * @example
 * ```tsx
 * <PageHeader
 *   title="Submit a Preprint"
 *   description="Share your research with the world"
 *   actions={
 *     <Button variant="outline">Save Draft</Button>
 *   }
 * />
 * ```
 *
 * @packageDocumentation
 */

import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for PageHeader component.
 */
export interface PageHeaderProps {
  /** Page title */
  title: string;

  /** Optional description or subtitle */
  description?: string;

  /** Optional action buttons */
  actions?: React.ReactNode;

  /** Whether to show a back button */
  showBack?: boolean;

  /** Back button click handler */
  onBack?: () => void;

  /** Additional CSS classes */
  className?: string;

  /** Title heading level (default: h1) */
  headingLevel?: 'h1' | 'h2' | 'h3';
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Consistent page header with title, description, and actions.
 *
 * @param props - Component props
 * @returns Header element
 */
export function PageHeader({
  title,
  description,
  actions,
  showBack,
  onBack,
  className,
  headingLevel = 'h1',
}: PageHeaderProps) {
  const Heading = headingLevel;

  const headingStyles: Record<string, string> = {
    h1: 'text-3xl font-bold tracking-tight',
    h2: 'text-2xl font-semibold tracking-tight',
    h3: 'text-xl font-semibold',
  };

  return (
    <header
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}
    >
      <div className="space-y-1">
        {showBack && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}
        <Heading className={headingStyles[headingLevel]}>{title}</Heading>
        {description && <p className="text-muted-foreground max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/**
 * Section header for use within pages.
 *
 * @remarks
 * Smaller than PageHeader, for subdividing content within a page.
 *
 * @example
 * ```tsx
 * <SectionHeader
 *   title="Authors"
 *   description="Add co-authors to your preprint"
 * />
 * ```
 */
export interface SectionHeaderProps {
  /** Section title */
  title: string;
  /** Optional description */
  description?: string;
  /** Optional actions */
  actions?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export function SectionHeader({ title, description, actions, className }: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
