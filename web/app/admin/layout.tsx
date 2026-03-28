import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LayoutDashboard,
  HeartPulse,
  Users,
  FileText,
  Shield,
  Radio,
  RefreshCw,
  Server,
  GitBranch,
  BarChart3,
  Search,
  Activity,
  Gauge,
  Cpu,
} from 'lucide-react';

import { AuthGuard } from '@/components/auth/auth-guard';
import { AdminGuard } from '@/components/auth/admin-guard';
import { SidebarLayout, SidebarSection } from '@/components/layout';

/**
 * Admin dashboard metadata.
 */
export const metadata: Metadata = {
  title: 'Admin Dashboard',
  description: 'Chive administration dashboard',
};

/**
 * Navigation sections for the admin sidebar.
 */
const navSections = [
  {
    title: 'System',
    items: [
      { href: '/admin', label: 'Overview', icon: LayoutDashboard },
      { href: '/admin/health', label: 'System Health', icon: HeartPulse },
    ],
  },
  {
    title: 'Operations',
    items: [
      { href: '/admin/users', label: 'Users & Roles', icon: Users },
      { href: '/admin/content', label: 'Content', icon: FileText },
      { href: '/admin/governance', label: 'Governance', icon: Shield },
    ],
  },
  {
    title: 'Infrastructure',
    items: [
      { href: '/admin/firehose', label: 'Firehose & Indexing', icon: Radio },
      { href: '/admin/backfill', label: 'Backfill Operations', icon: RefreshCw },
      { href: '/admin/pds', label: 'PDS Registry', icon: Server },
      { href: '/admin/graph', label: 'Knowledge Graph', icon: GitBranch },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { href: '/admin/metrics', label: 'Metrics & Trending', icon: BarChart3 },
      { href: '/admin/search-analytics', label: 'Search Analytics', icon: Search },
      { href: '/admin/activity', label: 'Activity & Correlation', icon: Activity },
      { href: '/admin/endpoints', label: 'Endpoint Performance', icon: Gauge },
      { href: '/admin/runtime', label: 'Node.js Runtime', icon: Cpu },
    ],
  },
];

/**
 * Admin sidebar navigation component.
 */
function AdminNav() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Admin</h2>
        <p className="text-sm text-muted-foreground">System administration</p>
      </div>
      {navSections.map((section) => (
        <div key={section.title}>
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {section.title}
          </p>
          <SidebarSection>
            {section.items.map((item) => (
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
      ))}
    </div>
  );
}

/**
 * Admin layout with sidebar navigation.
 *
 * @remarks
 * Protected by AuthGuard (requires authentication) and AdminGuard (requires admin role).
 * Uses the SidebarLayout component for consistent sidebar styling.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AdminGuard>
        <SidebarLayout sidebar={<AdminNav />} stickyNavigation sidebarTitle="Admin">
          {children}
        </SidebarLayout>
      </AdminGuard>
    </AuthGuard>
  );
}
