/**
 * Sidebar layout component for dashboard-style pages.
 *
 * @remarks
 * Provides a responsive sidebar layout with:
 * - Fixed-width sidebar on desktop
 * - Stacked layout on mobile
 * - Consistent spacing and gaps
 *
 * Used for dashboard and governance pages that need navigation sidebars.
 *
 * @example
 * ```tsx
 * <SidebarLayout sidebar={<DashboardNav />}>
 *   <DashboardContent />
 * </SidebarLayout>
 * ```
 *
 * @packageDocumentation
 */

import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Sidebar width options.
 */
export type SidebarWidth = 'sm' | 'md' | 'lg';

/**
 * Props for SidebarLayout component.
 */
export interface SidebarLayoutProps {
  /** Main content */
  children: React.ReactNode;

  /** Sidebar content */
  sidebar: React.ReactNode;

  /**
   * Sidebar width on desktop.
   *
   * @remarks
   * - `sm`: 200px (w-50)
   * - `md`: 256px (w-64) - default
   * - `lg`: 320px (w-80)
   */
  sidebarWidth?: SidebarWidth;

  /** Position of sidebar (default: 'left') */
  sidebarPosition?: 'left' | 'right';

  /** Whether sidebar is sticky on scroll */
  stickyNavigation?: boolean;

  /** Additional CSS classes for container */
  className?: string;

  /** Additional CSS classes for sidebar */
  sidebarClassName?: string;

  /** Additional CSS classes for main content */
  contentClassName?: string;
}

// =============================================================================
// STYLES
// =============================================================================

/**
 * Width classes for sidebar variants.
 */
const widthStyles: Record<SidebarWidth, string> = {
  sm: 'md:w-50', // 200px
  md: 'md:w-64', // 256px
  lg: 'md:w-80', // 320px
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Layout component with sidebar and main content area.
 *
 * @param props - Component props
 * @returns Layout element
 */
export function SidebarLayout({
  children,
  sidebar,
  sidebarWidth = 'md',
  sidebarPosition = 'left',
  stickyNavigation = false,
  className,
  sidebarClassName,
  contentClassName,
}: SidebarLayoutProps) {
  const sidebarElement = (
    <aside
      className={cn(
        'w-full shrink-0',
        widthStyles[sidebarWidth],
        stickyNavigation && 'md:sticky md:top-20 md:self-start',
        sidebarClassName
      )}
    >
      {sidebar}
    </aside>
  );

  const contentElement = <main className={cn('flex-1 min-w-0', contentClassName)}>{children}</main>;

  return (
    <div className={cn('container flex flex-col gap-8 py-8 md:flex-row md:gap-12', className)}>
      {sidebarPosition === 'left' ? (
        <>
          {sidebarElement}
          {contentElement}
        </>
      ) : (
        <>
          {contentElement}
          {sidebarElement}
        </>
      )}
    </div>
  );
}

/**
 * Sidebar navigation section with title.
 *
 * @remarks
 * Use within a sidebar to group navigation items.
 *
 * @example
 * ```tsx
 * <SidebarSection title="Dashboard">
 *   <SidebarLink href="/dashboard">Overview</SidebarLink>
 *   <SidebarLink href="/dashboard/eprints">My Eprints</SidebarLink>
 * </SidebarSection>
 * ```
 */
export interface SidebarSectionProps {
  /** Section title */
  title?: string;
  /** Child content (navigation links) */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export function SidebarSection({ title, children, className }: SidebarSectionProps) {
  return (
    <div className={cn('space-y-1', className)}>
      {title && (
        <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      )}
      <nav className="space-y-1">{children}</nav>
    </div>
  );
}
