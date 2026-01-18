'use client';

/**
 * Trusted editor status component.
 *
 * @remarks
 * Displays user's governance role, progress toward trusted editor,
 * and delegation status. Shows missing criteria and reputation metrics.
 *
 * @packageDocumentation
 */

import { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Star,
  Clock,
  FileText,
  Vote,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Award,
  BookOpen,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Governance role type.
 */
export type GovernanceRole =
  | 'community-member'
  | 'trusted-editor'
  | 'graph-editor'
  | 'domain-expert'
  | 'administrator';

/**
 * Reputation metrics from API.
 */
export interface ReputationMetrics {
  did: string;
  accountCreatedAt: number;
  accountAgeDays: number;
  eprintCount: number;
  wellEndorsedEprintCount: number;
  totalEndorsements: number;
  proposalCount: number;
  voteCount: number;
  successfulProposals: number;
  warningCount: number;
  violationCount: number;
  reputationScore: number;
  role: GovernanceRole;
  eligibleForTrustedEditor: boolean;
  missingCriteria: string[];
}

/**
 * Editor status from API.
 */
export interface EditorStatus {
  did: string;
  displayName?: string;
  role: GovernanceRole;
  roleGrantedAt?: number;
  roleGrantedBy?: string;
  hasDelegation: boolean;
  delegationExpiresAt?: number;
  delegationCollections?: string[];
  recordsCreatedToday: number;
  dailyRateLimit: number;
  metrics: ReputationMetrics;
}

/**
 * Props for TrustedEditorStatus component.
 */
export interface TrustedEditorStatusProps {
  /** Editor status data */
  status?: EditorStatus;
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string;
  /** Callback to refresh status */
  onRefresh?: () => void;
  /** Callback to request elevation */
  onRequestElevation?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Role display configuration.
 */
const ROLE_CONFIG: Record<
  GovernanceRole,
  { label: string; icon: typeof Shield; color: string; description: string }
> = {
  'community-member': {
    label: 'Community Member',
    icon: Shield,
    color: 'text-muted-foreground',
    description: 'Can create proposals and vote on governance decisions',
  },
  'trusted-editor': {
    label: 'Trusted Editor',
    icon: ShieldCheck,
    color: 'text-green-600 dark:text-green-400',
    description: 'Can create and edit nodes in the Governance PDS',
  },
  'graph-editor': {
    label: 'Graph Editor',
    icon: BookOpen,
    color: 'text-blue-600 dark:text-blue-400',
    description: 'Library science verified editor with enhanced graph voting weight',
  },
  'domain-expert': {
    label: 'Domain Expert',
    icon: Star,
    color: 'text-amber-600 dark:text-amber-400',
    description: 'Recognized expert in specific research fields',
  },
  administrator: {
    label: 'Administrator',
    icon: Award,
    color: 'text-purple-600 dark:text-purple-400',
    description: 'Full governance committee member',
  },
};

/**
 * Criteria thresholds for display.
 */
const CRITERIA_THRESHOLDS = {
  minAccountAgeDays: 90,
  minEprints: 10,
  minProposalsAndVotes: 20,
  minReputationScore: 0.7,
};

/**
 * Trusted editor status component.
 *
 * @example
 * ```tsx
 * <TrustedEditorStatus
 *   status={editorStatus}
 *   isLoading={isLoading}
 *   onRefresh={handleRefresh}
 *   onRequestElevation={handleRequestElevation}
 * />
 * ```
 */
export function TrustedEditorStatus({
  status,
  isLoading,
  error,
  onRefresh,
  onRequestElevation,
  className,
}: TrustedEditorStatusProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading) {
    return <TrustedEditorStatusSkeleton className={className} />;
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!status) {
    return null;
  }

  const roleConfig = ROLE_CONFIG[status.role];
  const RoleIcon = roleConfig.icon;
  const metrics = status.metrics;

  // Calculate progress percentages
  const accountAgeProgress = Math.min(
    (metrics.accountAgeDays / CRITERIA_THRESHOLDS.minAccountAgeDays) * 100,
    100
  );
  const eprintsProgress = Math.min(
    (metrics.wellEndorsedEprintCount / CRITERIA_THRESHOLDS.minEprints) * 100,
    100
  );
  const participationProgress = Math.min(
    ((metrics.proposalCount + metrics.voteCount) / CRITERIA_THRESHOLDS.minProposalsAndVotes) * 100,
    100
  );
  const reputationProgress = Math.min(
    (metrics.reputationScore / CRITERIA_THRESHOLDS.minReputationScore) * 100,
    100
  );

  const isTrustedOrHigher = status.role !== 'community-member';

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('rounded-full bg-muted p-2', roleConfig.color)}>
              <RoleIcon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{roleConfig.label}</CardTitle>
              <CardDescription>{roleConfig.description}</CardDescription>
            </div>
          </div>
          {onRefresh && (
            <Button variant="ghost" size="icon" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Delegation Status */}
        {isTrustedOrHigher && (
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Governance PDS Delegation</span>
              {status.hasDelegation ? (
                <Badge
                  variant="outline"
                  className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Active
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                >
                  <AlertCircle className="mr-1 h-3 w-3" />
                  Inactive
                </Badge>
              )}
            </div>
            {status.hasDelegation && (
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Records today</span>
                  <span>
                    {status.recordsCreatedToday} / {status.dailyRateLimit}
                  </span>
                </div>
                {status.delegationExpiresAt && (
                  <div className="flex justify-between">
                    <span>Expires</span>
                    <span>{new Date(status.delegationExpiresAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Eligibility Status for Community Members */}
        {status.role === 'community-member' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progress to Trusted Editor</span>
                <span className="font-medium">
                  {Math.round(
                    (accountAgeProgress +
                      eprintsProgress +
                      participationProgress +
                      reputationProgress) /
                      4
                  )}
                  %
                </span>
              </div>
              <Progress
                value={
                  (accountAgeProgress +
                    eprintsProgress +
                    participationProgress +
                    reputationProgress) /
                  4
                }
                className="h-2"
              />
            </div>

            {metrics.eligibleForTrustedEditor ? (
              <Alert className="bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertTitle className="text-green-800 dark:text-green-200">
                  Eligible for Trusted Editor
                </AlertTitle>
                <AlertDescription className="text-green-700 dark:text-green-300">
                  You meet all criteria for automatic elevation.
                  {onRequestElevation && (
                    <Button
                      variant="link"
                      className="h-auto p-0 pl-1 text-green-700 dark:text-green-300"
                      onClick={onRequestElevation}
                    >
                      Request elevation
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Not Yet Eligible</AlertTitle>
                <AlertDescription>
                  {metrics.missingCriteria.length} criteria remaining
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {/* Expandable Metrics */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              <span className="text-sm">Reputation Metrics</span>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            {/* Account Age */}
            <MetricRow
              icon={Clock}
              label="Account Age"
              value={`${metrics.accountAgeDays} days`}
              target={`${CRITERIA_THRESHOLDS.minAccountAgeDays} days`}
              progress={accountAgeProgress}
              met={metrics.accountAgeDays >= CRITERIA_THRESHOLDS.minAccountAgeDays}
            />

            {/* Well-endorsed Eprints */}
            <MetricRow
              icon={FileText}
              label="Well-endorsed Eprints"
              value={`${metrics.wellEndorsedEprintCount}`}
              target={`${CRITERIA_THRESHOLDS.minEprints}`}
              progress={eprintsProgress}
              met={metrics.wellEndorsedEprintCount >= CRITERIA_THRESHOLDS.minEprints}
            />

            {/* Participation */}
            <MetricRow
              icon={Vote}
              label="Proposals & Votes"
              value={`${metrics.proposalCount + metrics.voteCount}`}
              target={`${CRITERIA_THRESHOLDS.minProposalsAndVotes}`}
              progress={participationProgress}
              met={
                metrics.proposalCount + metrics.voteCount >=
                CRITERIA_THRESHOLDS.minProposalsAndVotes
              }
            />

            {/* Reputation Score */}
            <MetricRow
              icon={Star}
              label="Reputation Score"
              value={metrics.reputationScore.toFixed(2)}
              target={CRITERIA_THRESHOLDS.minReputationScore.toFixed(2)}
              progress={reputationProgress}
              met={metrics.reputationScore >= CRITERIA_THRESHOLDS.minReputationScore}
            />

            {/* Warnings/Violations */}
            {(metrics.warningCount > 0 || metrics.violationCount > 0) && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <XCircle className="h-4 w-4" />
                  <span>
                    {metrics.warningCount > 0 && `${metrics.warningCount} active warning(s)`}
                    {metrics.warningCount > 0 && metrics.violationCount > 0 && ', '}
                    {metrics.violationCount > 0 && `${metrics.violationCount} violation(s)`}
                  </span>
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

/**
 * Metric row component.
 */
function MetricRow({
  icon: Icon,
  label,
  value,
  target,
  progress,
  met,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  target: string;
  progress: number;
  met: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">{value}</span>
          <span className="text-muted-foreground">/ {target}</span>
          {met ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>
      <Progress value={progress} className="h-1" />
    </div>
  );
}

/**
 * Loading skeleton for TrustedEditorStatus.
 */
export function TrustedEditorStatusSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}
