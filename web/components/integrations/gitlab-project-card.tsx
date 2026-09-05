'use client';

/**
 * A GitLab project, rendered as the page's standard link card.
 *
 * @packageDocumentation
 */

import { Star, GitFork, Eye, EyeOff } from 'lucide-react';

import { ResourceCard, type ResourceStat } from '@/components/links/resource-card';
import type { GitLabIntegration } from '@/lib/hooks/use-integrations';

import { GitlabMark } from './brand-marks';

export interface GitLabProjectCardProps {
  project: GitLabIntegration;
  className?: string;
}

/**
 * Displays GitLab project information.
 *
 * @param props - Component props
 * @returns The card
 *
 * @public
 */
export function GitLabProjectCard({ project, className }: GitLabProjectCardProps) {
  const isPublic = project.visibility === 'public';

  const stats: ResourceStat[] = [
    { icon: isPublic ? Eye : EyeOff, label: project.visibility },
    // Never render a placeholder count as a real one.
    {
      icon: Star,
      label: project.unavailable ? '—' : project.stars.toLocaleString(),
      title: 'Stars',
    },
    {
      icon: GitFork,
      label: project.unavailable ? '—' : project.forks.toLocaleString(),
      title: 'Forks',
    },
  ];

  return (
    <ResourceCard
      className={className}
      icon={GitlabMark}
      iconBg="bg-orange-50 dark:bg-orange-950"
      title={project.pathWithNamespace}
      badge="GitLab"
      description={project.description ?? undefined}
      stats={stats}
      tags={project.topics}
      href={project.url}
    />
  );
}
