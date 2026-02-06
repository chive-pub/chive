'use client';

/**
 * Publication status badge with link to published version.
 *
 * @remarks
 * Displays the current publication status and provides a prominent
 * link to the published version (Version of Record) when available.
 *
 * @packageDocumentation
 */

import { ExternalLink, BookOpen, FileCheck, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

import type { PublicationStatus } from '@/lib/api/generated/types/pub/chive/defs';
export type { PublicationStatus };

/**
 * Published version information.
 */
export interface PublishedVersion {
  doi?: string;
  url?: string;
  journal?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;
}

/**
 * Props for PublicationBadge component.
 */
export interface PublicationBadgeProps {
  /** Current publication status */
  status: PublicationStatus;
  /** Published version details (if applicable) */
  publishedVersion?: PublishedVersion;
  /** Display variant */
  variant?: 'badge' | 'card' | 'inline';
  /** Additional class names */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Status configuration for known statuses.
 *
 * @remarks
 * Publication statuses are governance-controlled via knowledge graph nodes.
 * This config provides display styling for known statuses. Unknown statuses
 * fall back to DEFAULT_STATUS_CONFIG.
 */
interface StatusConfig {
  label: string;
  icon: typeof BookOpen;
  color: 'default' | 'secondary' | 'destructive' | 'outline';
  bgColor: string;
}

const DEFAULT_STATUS_CONFIG: StatusConfig = {
  label: 'Unknown',
  icon: FileCheck,
  color: 'secondary',
  bgColor: 'bg-gray-50 dark:bg-gray-950/20',
};

const STATUS_CONFIG: Record<string, StatusConfig> = {
  eprint: {
    label: 'Eprint',
    icon: FileCheck,
    color: 'secondary',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
  },
  preprint: {
    label: 'Preprint',
    icon: FileCheck,
    color: 'secondary',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
  },
  under_review: {
    label: 'Under Review',
    icon: Clock,
    color: 'outline',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
  },
  revision_requested: {
    label: 'Revision Requested',
    icon: Clock,
    color: 'outline',
    bgColor: 'bg-orange-50 dark:bg-orange-950/20',
  },
  accepted: {
    label: 'Accepted',
    icon: CheckCircle,
    color: 'default',
    bgColor: 'bg-green-50 dark:bg-green-950/20',
  },
  in_press: {
    label: 'In Press',
    icon: BookOpen,
    color: 'default',
    bgColor: 'bg-green-50 dark:bg-green-950/20',
  },
  published: {
    label: 'Published',
    icon: BookOpen,
    color: 'default',
    bgColor: 'bg-green-50 dark:bg-green-950/20',
  },
  retracted: {
    label: 'Retracted',
    icon: AlertTriangle,
    color: 'destructive',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
  },
  withdrawn: {
    label: 'Withdrawn',
    icon: AlertTriangle,
    color: 'destructive',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
  },
};

/**
 * Gets status config with fallback for unknown statuses.
 */
function getStatusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status] ?? DEFAULT_STATUS_CONFIG;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Publication status badge with link to published version.
 *
 * @param props - Component props
 * @returns Publication badge element
 */
export function PublicationBadge({
  status,
  publishedVersion,
  variant = 'badge',
  className,
}: PublicationBadgeProps) {
  const config = getStatusConfig(status);
  const Icon = config.icon;
  const hasPublishedVersion = publishedVersion && (publishedVersion.doi || publishedVersion.url);

  // Badge variant - compact inline display
  if (variant === 'badge') {
    return (
      <Badge variant={config.color} className={cn('gap-1', className)}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  }

  // Inline variant - badge with optional link
  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Badge variant={config.color} className="gap-1">
          <Icon className="h-3 w-3" />
          {config.label}
        </Badge>
        {hasPublishedVersion && (
          <a
            href={
              publishedVersion.doi
                ? `https://doi.org/${publishedVersion.doi}`
                : publishedVersion.url
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View published version
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    );
  }

  // Card variant - prominent display with full details
  return (
    <Card className={cn(config.bgColor, 'border-0', className)}>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{config.label}</span>
                {status === 'retracted' && (
                  <Badge variant="destructive" className="text-xs">
                    Warning
                  </Badge>
                )}
              </div>
              {hasPublishedVersion && publishedVersion.journal && (
                <p className="text-sm text-muted-foreground">
                  {publishedVersion.journal}
                  {publishedVersion.volume && ` ${publishedVersion.volume}`}
                  {publishedVersion.issue && `(${publishedVersion.issue})`}
                  {publishedVersion.pages && `: ${publishedVersion.pages}`}
                </p>
              )}
            </div>
          </div>

          {hasPublishedVersion && (
            <Button asChild variant="outline" size="sm">
              <a
                href={
                  publishedVersion.doi
                    ? `https://doi.org/${publishedVersion.doi}`
                    : publishedVersion.url
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Published Version
              </a>
            </Button>
          )}
        </div>

        {publishedVersion?.doi && (
          <p className="mt-3 text-xs text-muted-foreground font-mono">
            DOI: {publishedVersion.doi}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
