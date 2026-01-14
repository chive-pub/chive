import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  ThumbsUp,
  Settings,
  Upload,
  Bell,
} from 'lucide-react';

import { AlphaGate } from '@/components/alpha';
import { AuthGuard } from '@/components/auth/auth-guard';
import { SidebarLayout, SidebarSection } from '@/components/layout';

/**
 * Dashboard metadata.
 */
export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your personal Chive dashboard',
};

/**
 * Dashboard navigation items.
 */
const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/eprints', label: 'My Eprints', icon: FileText },
  { href: '/dashboard/claims', label: 'Import Papers', icon: Upload },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/reviews', label: 'My Reviews', icon: MessageSquare },
  { href: '/dashboard/endorsements', label: 'My Endorsements', icon: ThumbsUp },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

/**
 * Dashboard sidebar navigation component.
 */
function DashboardNav() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Your personal workspace</p>
      </div>
      <SidebarSection>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </SidebarSection>
    </div>
  );
}

/**
 * Dashboard layout with sidebar navigation.
 *
 * @remarks
 * Uses the SidebarLayout component for consistent sidebar styling.
 * Protected by AuthGuard (requires authentication) and AlphaGate (requires alpha approval).
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AlphaGate>
        <SidebarLayout sidebar={<DashboardNav />} stickyNavigation>
          {children}
        </SidebarLayout>
      </AlphaGate>
    </AuthGuard>
  );
}
