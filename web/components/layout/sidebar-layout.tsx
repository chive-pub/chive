'use client';

/**
 * Sidebar layout component for dashboard-style pages.
 *
 * @remarks
 * Provides a responsive sidebar layout with:
 * - Sheet drawer on mobile (triggered by menu button)
 * - Fixed-width sidebar on desktop
 * - Consistent spacing and gaps
 *
 * Used for dashboard, admin, and governance pages that need navigation sidebars.
 */

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { PanelLeft } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

// =============================================================================
// TYPES
// =============================================================================

export type SidebarWidth = 'sm' | 'md' | 'lg';

export interface SidebarLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  sidebarWidth?: SidebarWidth;
  sidebarPosition?: 'left' | 'right';
  stickyNavigation?: boolean;
  /** Label shown on the mobile Sheet trigger button */
  sidebarTitle?: string;
  className?: string;
  sidebarClassName?: string;
  contentClassName?: string;
}

// =============================================================================
// STYLES
// =============================================================================

const widthStyles: Record<SidebarWidth, string> = {
  sm: 'md:w-50',
  md: 'md:w-64',
  lg: 'md:w-80',
};

// =============================================================================
// COMPONENT
// =============================================================================

export function SidebarLayout({
  children,
  sidebar,
  sidebarWidth = 'md',
  sidebarPosition = 'left',
  stickyNavigation = false,
  sidebarTitle = 'Navigation',
  className,
  sidebarClassName,
  contentClassName,
}: SidebarLayoutProps) {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const pathname = usePathname();

  // Close sheet on navigation
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  if (isMobile) {
    const side = sidebarPosition === 'left' ? 'left' : 'right';
    return (
      <div className={cn('container py-6', className)}>
        <div className="mb-4">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <PanelLeft className="mr-2 h-4 w-4" />
                {sidebarTitle}
              </Button>
            </SheetTrigger>
            <SheetContent side={side} className="w-[280px] p-0">
              <SheetTitle className="sr-only">{sidebarTitle}</SheetTitle>
              <ScrollArea className="h-full px-4 py-6">{sidebar}</ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
        <main className={cn('min-w-0', contentClassName)}>{children}</main>
      </div>
    );
  }

  const sidebarElement = (
    <aside
      className={cn(
        'shrink-0',
        widthStyles[sidebarWidth],
        stickyNavigation && 'md:sticky md:top-20 md:self-start',
        sidebarClassName
      )}
    >
      {sidebar}
    </aside>
  );

  return (
    <div className={cn('container flex gap-12 py-8', className)}>
      {sidebarPosition === 'left' && sidebarElement}
      <main className={cn('flex-1 min-w-0', contentClassName)}>{children}</main>
      {sidebarPosition === 'right' && sidebarElement}
    </div>
  );
}

/**
 * Sidebar navigation section with title.
 */
export interface SidebarSectionProps {
  title?: string;
  children: React.ReactNode;
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
