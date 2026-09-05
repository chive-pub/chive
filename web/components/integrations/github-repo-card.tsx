'use client';

/**
 * A GitHub repository, with what GitHub says about it.
 *
 * @remarks
 * This card is the page's reference for how a link should read: the repository
 * leads, the service sits beside it, and the facts that tell a reader whether
 * it is worth opening -- language, stars, forks, licence, topics -- come from
 * GitHub rather than from the eprint record. Every other link on the page now
 * renders through the same card, with whatever detail its own source can give.
 *
 * @packageDocumentation
 */

import { Star, GitFork, Code2, Scale } from 'lucide-react';

import { ResourceCard, type ResourceStat } from '@/components/links/resource-card';
import type { GitHubIntegration } from '@/lib/hooks/use-integrations';

import { GithubMark } from './brand-marks';

export interface GitHubRepoCardProps {
  repo: GitHubIntegration;
  className?: string;
}

/**
 * Displays GitHub repository information.
 *
 * @param props - Component props
 * @returns The card
 *
 * @public
 */
export function GitHubRepoCard({ repo, className }: GitHubRepoCardProps) {
  const stats: ResourceStat[] = [];
  if (repo.language) stats.push({ icon: Code2, label: repo.language });
  // Never render a placeholder count as a real one.
  stats.push({
    icon: Star,
    label: repo.unavailable ? '—' : repo.stars.toLocaleString(),
    title: 'Stars',
  });
  stats.push({
    icon: GitFork,
    label: repo.unavailable ? '—' : repo.forks.toLocaleString(),
    title: 'Forks',
  });
  if (repo.license) stats.push({ icon: Scale, label: repo.license });

  return (
    <ResourceCard
      className={className}
      icon={GithubMark}
      iconColor="text-gray-900 dark:text-gray-100"
      iconBg="bg-gray-100 dark:bg-gray-800"
      title={`${repo.owner}/${repo.repo}`}
      badge="GitHub"
      description={
        repo.unavailable
          ? 'GitHub could not be reached, so this repository’s details are unavailable.'
          : (repo.description ?? undefined)
      }
      stats={stats}
      tags={repo.topics}
      href={repo.url}
    />
  );
}
