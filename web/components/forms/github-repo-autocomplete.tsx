'use client';

/**
 * GitHub repository autocomplete input component.
 *
 * @remarks
 * Searches GitHub API for repositories.
 * Displays repository name, description, stars, and language.
 *
 * @example
 * ```tsx
 * <GithubRepoAutocomplete
 *   onSelect={(repo) => {
 *     form.setValue('repositories.code[0].url', repo.url);
 *     form.setValue('repositories.code[0].label', repo.fullName);
 *   }}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useCallback } from 'react';
import { Github, Star, GitFork, Code } from 'lucide-react';

import { logger } from '@/lib/observability';
import { AutocompleteInput } from './autocomplete-input';

const log = logger.child({ component: 'github-repo-autocomplete' });

// =============================================================================
// TYPES
// =============================================================================

/**
 * GitHub repository result.
 */
export interface GithubRepo {
  /** Repository ID */
  id: number;
  /** Full repository name (owner/repo) */
  fullName: string;
  /** Repository name only */
  name: string;
  /** Owner username */
  owner: string;
  /** Repository description */
  description: string | null;
  /** Primary language */
  language: string | null;
  /** Star count */
  stars: number;
  /** Fork count */
  forks: number;
  /** Repository URL */
  url: string;
  /** Whether it's a fork */
  isFork: boolean;
  /** Last update date */
  updatedAt: string | null;
  /** Topics/tags */
  topics: string[];
  /** License name */
  license: string | null;
}

/**
 * GitHub search API response.
 */
interface GithubSearchResponse {
  total_count: number;
  items: Array<{
    id: number;
    full_name: string;
    name: string;
    owner: { login: string };
    description: string | null;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    html_url: string;
    fork: boolean;
    updated_at: string;
    topics: string[];
    license: { name: string } | null;
  }>;
}

/**
 * Props for GithubRepoAutocomplete component.
 */
export interface GithubRepoAutocompleteProps {
  /** Current repository URL value */
  value?: string;
  /** Called when a repository is selected */
  onSelect: (repo: GithubRepo) => void;
  /** Called when input value changes */
  onChange?: (value: string) => void;
  /** Called when selection is cleared */
  onClear?: () => void;
  /** Input placeholder */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Input ID */
  id?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const GITHUB_API_URL = 'https://api.github.com/search/repositories';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Format star count for display.
 */
function formatStars(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

/**
 * Transform GitHub API response to our repo type.
 */
function transformGithubResponse(data: GithubSearchResponse): GithubRepo[] {
  return data.items.map((item) => ({
    id: item.id,
    fullName: item.full_name,
    name: item.name,
    owner: item.owner.login,
    description: item.description,
    language: item.language,
    stars: item.stargazers_count,
    forks: item.forks_count,
    url: item.html_url,
    isFork: item.fork,
    updatedAt: item.updated_at?.slice(0, 10) ?? null,
    topics: item.topics ?? [],
    license: item.license?.name ?? null,
  }));
}

/**
 * Search GitHub for repositories.
 */
async function searchGithub(query: string): Promise<GithubRepo[]> {
  const params = new URLSearchParams({
    q: query,
    per_page: '10',
    sort: 'stars',
    order: 'desc',
  });

  const response = await fetch(`${GITHUB_API_URL}?${params.toString()}`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    log.error('GitHub search failed', undefined, {
      query,
      status: response.status,
      statusText: response.statusText,
    });
    return [];
  }

  const data: GithubSearchResponse = await response.json();
  return transformGithubResponse(data);
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Render a single GitHub repository result.
 */
function GithubRepoResultItem({ repo }: { repo: GithubRepo }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Github className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium">{repo.fullName}</span>
      </div>
      {repo.description && (
        <p className="text-xs text-muted-foreground line-clamp-1">{repo.description}</p>
      )}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3 text-yellow-500" />
          <span>{formatStars(repo.stars)}</span>
        </div>
        {repo.forks > 0 && (
          <div className="flex items-center gap-1">
            <GitFork className="h-3 w-3" />
            <span>{formatStars(repo.forks)}</span>
          </div>
        )}
        {repo.language && (
          <div className="flex items-center gap-1">
            <Code className="h-3 w-3" />
            <span>{repo.language}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * GitHub repository autocomplete input.
 *
 * @param props - Component props
 * @returns GitHub repository autocomplete element
 */
export function GithubRepoAutocomplete({
  value,
  onSelect,
  onChange,
  onClear,
  placeholder = 'Search GitHub repositories...',
  disabled = false,
  className,
  id,
}: GithubRepoAutocompleteProps) {
  const renderItem = useCallback((repo: GithubRepo) => <GithubRepoResultItem repo={repo} />, []);

  const getItemKey = useCallback((repo: GithubRepo) => repo.id.toString(), []);
  const getItemValue = useCallback((repo: GithubRepo) => repo.fullName, []);

  return (
    <AutocompleteInput<GithubRepo>
      id={id}
      placeholder={placeholder}
      groupLabel="Repositories"
      queryFn={searchGithub}
      queryKeyPrefix="github-repo-search"
      onSelect={onSelect}
      onInputChange={onChange}
      onClear={onClear}
      renderItem={renderItem}
      getItemKey={getItemKey}
      getItemValue={getItemValue}
      initialValue={value}
      minChars={2}
      debounceMs={400}
      staleTime={30 * 1000}
      emptyMessage="No repositories found."
      disabled={disabled}
      className={className}
    />
  );
}
