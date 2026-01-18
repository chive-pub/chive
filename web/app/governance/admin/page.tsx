'use client';

/**
 * Governance admin page.
 *
 * @remarks
 * Administrative dashboard for governance committee members to manage
 * trusted editors, delegations, and review pending requests.
 * Only accessible to administrators.
 */

import { ConnectedGovernanceAdminDashboard } from '@/components/governance';

export default function GovernanceAdminPage() {
  return <ConnectedGovernanceAdminDashboard />;
}
