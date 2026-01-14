'use client';

import { Code2, Database, Archive } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useIntegrations, hasIntegrations } from '@/lib/hooks/use-integrations';

import { GitHubRepoCard } from './github-repo-card';
import { GitLabProjectCard } from './gitlab-project-card';
import { ZenodoBadge } from './zenodo-badge';
import { SoftwareHeritageBadge } from './software-heritage-badge';
import { DatasetLinks } from './dataset-links';

export interface IntegrationPanelProps {
  eprintUri: string;
  className?: string;
}

/**
 * Skeleton loader for integration panel.
 */
export function IntegrationPanelSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Code2 className="h-4 w-4" />
          Integrations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Displays aggregated plugin integration data for an eprint.
 *
 * @remarks
 * Shows linked repositories (GitHub, GitLab), archived data (Zenodo, Software Heritage),
 * and dataset links (Figshare, Dryad, OSF) based on the eprint's supplementary materials.
 *
 * @example
 * ```tsx
 * <IntegrationPanel eprintUri="at://did:plc:abc/pub.chive.eprint.submission/123" />
 * ```
 */
export function IntegrationPanel({ eprintUri, className }: IntegrationPanelProps) {
  const { data, isLoading, error } = useIntegrations(eprintUri);

  if (isLoading) {
    return <IntegrationPanelSkeleton className={className} />;
  }

  if (error || !data || !hasIntegrations(data)) {
    // Don't show the panel if there are no integrations
    return null;
  }

  const hasCode =
    (data.github && data.github.length > 0) || (data.gitlab && data.gitlab.length > 0);
  const hasArchival =
    (data.zenodo && data.zenodo.length > 0) ||
    (data.softwareHeritage && data.softwareHeritage.length > 0);
  const hasData = data.datasets && data.datasets.length > 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Code2 className="h-4 w-4" />
          Linked Resources
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Code Repositories */}
        {hasCode && (
          <section className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Code2 className="h-3.5 w-3.5" />
              Code Repositories
            </h4>
            <div className="grid gap-3">
              {data.github?.map((repo, index) => (
                <GitHubRepoCard key={`github-${index}`} repo={repo} />
              ))}
              {data.gitlab?.map((project, index) => (
                <GitLabProjectCard key={`gitlab-${index}`} project={project} />
              ))}
            </div>
          </section>
        )}

        {/* Archival */}
        {hasArchival && (
          <section className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Archive className="h-3.5 w-3.5" />
              Archival & DOIs
            </h4>
            <div className="grid gap-3">
              {data.zenodo?.map((record, index) => (
                <ZenodoBadge key={`zenodo-${index}`} record={record} variant="card" />
              ))}
              {data.softwareHeritage?.map((swh, index) => (
                <SoftwareHeritageBadge key={`swh-${index}`} data={swh} variant="card" />
              ))}
            </div>
          </section>
        )}

        {/* Datasets */}
        {hasData && (
          <section className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Database className="h-3.5 w-3.5" />
              Data & Supplementary Materials
            </h4>
            <DatasetLinks datasets={data.datasets!} />
          </section>
        )}
      </CardContent>
    </Card>
  );
}
