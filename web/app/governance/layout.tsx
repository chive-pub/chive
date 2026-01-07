import type { Metadata } from 'next';
import Link from 'next/link';
import { Vote, FileText, CheckCircle, Clock, Shield } from 'lucide-react';

import { AlphaGate } from '@/components/alpha';
import { AuthGuard } from '@/components/auth/auth-guard';
import { SidebarLayout, SidebarSection } from '@/components/layout';

/**
 * Governance section metadata.
 */
export const metadata: Metadata = {
  title: 'Governance | Chive',
  description: 'Community governance for the Chive knowledge graph',
};

/**
 * Navigation items for governance sidebar.
 */
const navItems = [
  { href: '/governance', label: 'Dashboard', icon: Vote },
  { href: '/governance/proposals', label: 'All Proposals', icon: FileText },
  { href: '/governance/proposals?status=pending', label: 'Pending', icon: Clock },
  { href: '/governance/proposals?status=approved', label: 'Approved', icon: CheckCircle },
  { href: '/governance/moderation', label: 'Moderation', icon: Shield },
];

/**
 * Governance sidebar navigation component.
 */
function GovernanceNav() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Governance</h2>
        <p className="text-sm text-muted-foreground">Community-driven knowledge graph moderation</p>
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
 * Governance layout with sidebar navigation.
 *
 * @remarks
 * Uses the SidebarLayout component for consistent sidebar styling
 * across governance pages.
 * Protected by AuthGuard (requires authentication) and AlphaGate (requires alpha approval).
 */
export default function GovernanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AlphaGate>
        <SidebarLayout sidebar={<GovernanceNav />} stickyNavigation>
          {children}
        </SidebarLayout>
      </AlphaGate>
    </AuthGuard>
  );
}
