import { useQuery } from '@tanstack/react-query';

/**
 * GitHub repository integration data.
 */
export interface GitHubIntegration {
  type: 'github';
  owner: string;
  repo: string;
  url: string;
  stars: number;
  forks: number;
  language: string | null;
  description: string | null;
  license: string | null;
  lastUpdated: string;
  topics: readonly string[];
}

/**
 * GitLab project integration data.
 */
export interface GitLabIntegration {
  type: 'gitlab';
  pathWithNamespace: string;
  name: string;
  url: string;
  stars: number;
  forks: number;
  description: string | null;
  visibility: string;
  topics: readonly string[];
  lastActivityAt: string;
}

/**
 * Zenodo record integration data.
 */
export interface ZenodoIntegration {
  type: 'zenodo';
  doi: string;
  conceptDoi?: string;
  title: string;
  url: string;
  resourceType: string;
  accessRight: string;
  version?: string;
  stats?: {
    downloads: number;
    views: number;
  };
}

/**
 * Software Heritage integration data.
 */
export interface SoftwareHeritageIntegration {
  type: 'software-heritage';
  originUrl: string;
  archived: boolean;
  lastVisit?: string;
  lastSnapshotSwhid?: string;
  browseUrl?: string;
}

/**
 * Dataset integration data (Figshare, Dryad, OSF).
 */
export interface DatasetIntegration {
  type: 'figshare' | 'dryad' | 'osf';
  doi?: string;
  title: string;
  url: string;
  description?: string;
}

/**
 * Combined integrations response.
 */
export interface IntegrationsData {
  eprintUri: string;
  github?: GitHubIntegration[];
  gitlab?: GitLabIntegration[];
  zenodo?: ZenodoIntegration[];
  softwareHeritage?: SoftwareHeritageIntegration[];
  datasets?: DatasetIntegration[];
  lastUpdated: string;
}

/**
 * Query key factory for integrations queries.
 */
export const integrationKeys = {
  all: ['integrations'] as const,
  detail: (eprintUri: string) => [...integrationKeys.all, eprintUri] as const,
};

/**
 * Options for the useIntegrations hook.
 */
interface UseIntegrationsOptions {
  enabled?: boolean;
}

/**
 * Get the API base URL for integrations.
 */
function getApiBaseUrl(): string {
  const isServer = typeof window === 'undefined';
  const isTunnelMode =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEV_MODE === 'tunnel';

  if (isServer) {
    return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
  }

  if (isTunnelMode) {
    return '';
  }

  return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
}

/**
 * Fetches integration data for an eprint.
 *
 * @remarks
 * Returns cached plugin data from external integrations (GitHub, GitLab, Zenodo,
 * Software Heritage, etc.) for a given eprint based on its supplementary links.
 *
 * @example
 * ```tsx
 * const { data: integrations, isLoading } = useIntegrations(
 *   'at://did:plc:abc/pub.chive.eprint.submission/123'
 * );
 *
 * if (integrations?.github?.length > 0) {
 *   return <GitHubRepoCard repo={integrations.github[0]} />;
 * }
 * ```
 *
 * @param eprintUri - AT Protocol URI of the eprint
 * @param options - Query options
 * @returns Query result with integration data
 */
export function useIntegrations(eprintUri: string, options: UseIntegrationsOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: integrationKeys.detail(eprintUri),
    queryFn: async (): Promise<IntegrationsData> => {
      const baseUrl = getApiBaseUrl();
      const encodedUri = encodeURIComponent(eprintUri);
      const response = await fetch(`${baseUrl}/api/v1/eprints/${encodedUri}/integrations`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch integrations: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: enabled && !!eprintUri,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Check if any integrations are available.
 */
export function hasIntegrations(data: IntegrationsData | undefined): boolean {
  if (!data) return false;
  return !!(
    (data.github && data.github.length > 0) ||
    (data.gitlab && data.gitlab.length > 0) ||
    (data.zenodo && data.zenodo.length > 0) ||
    (data.softwareHeritage && data.softwareHeritage.length > 0) ||
    (data.datasets && data.datasets.length > 0)
  );
}
