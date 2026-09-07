'use client';

/**
 * A paper's code, as richly as Chive can describe it.
 *
 * @remarks
 * The same repository was being drawn twice, from two sources, and the better
 * card was on the wrong tab. The Code tab rendered `repositories.code` off the
 * eprint record -- a URL, a label and a platform slug, which is all the author
 * typed -- while the Metadata tab rendered the integration data Chive fetches
 * from GitHub, with the description, language, stars, forks and licence. A
 * reader looking for the code found the thin version; the useful one was filed
 * under Metadata, where nobody looks for code.
 *
 * The two are joined here. A declared repository is matched to its fetched
 * counterpart by URL and drawn with everything known about it; one Chive could
 * not reach still renders from what the record says. Metadata no longer repeats
 * any of it.
 *
 * @packageDocumentation
 */

import { Archive, Code2 } from 'lucide-react';

import { GitHubRepoCard } from '@/components/integrations/github-repo-card';
import { GitLabProjectCard } from '@/components/integrations/gitlab-project-card';
import { SoftwareHeritageBadge } from '@/components/integrations/software-heritage-badge';
import { RepositoriesPanel } from '@/components/eprints/repositories-panel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useIntegrations } from '@/lib/hooks/use-integrations';
import type { Repositories } from '@/lib/api/schema';

/** Props for {@link CodeResources}. */
export interface CodeResourcesProps {
  /** The paper whose code this is. */
  readonly eprintUri: string;
  /** Repositories as the eprint record declares them. */
  readonly repositories?: Repositories;
  readonly className?: string;
}

/**
 * Compares two repository addresses.
 *
 * @param a - One address
 * @param b - The other
 * @returns Whether they name the same repository
 *
 * @remarks
 * A record may carry `https://github.com/owner/repo.git`, a trailing slash, or
 * a different case from what the integration reports. None of those make it a
 * different repository.
 */
function sameRepository(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const normalise = (url: string): string =>
    url
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\.git$/, '')
      .replace(/\/$/, '');
  return normalise(a) === normalise(b);
}

/**
 * Renders a paper's code repositories and their archival status.
 *
 * @param props - Component props
 * @returns The panel, or nothing when the paper declares no code
 *
 * @public
 */
export function CodeResources({ eprintUri, repositories, className }: CodeResourcesProps) {
  const { data } = useIntegrations(eprintUri);

  const declared = repositories?.code ?? [];
  if (declared.length === 0) return null;

  const github = data?.github ?? [];
  const gitlab = data?.gitlab ?? [];
  const archives = data?.softwareHeritage ?? [];

  // Which declared repositories Chive was able to fetch, and which it was not.
  const enriched = declared.map((repo) => ({
    repo,
    github: github.find((g) => sameRepository(g.url, repo.url)),
    gitlab: gitlab.find((g) => sameRepository(g.url, repo.url)),
  }));

  const plain = enriched.filter((e) => !e.github && !e.gitlab).map((e) => e.repo);

  return (
    <div className={className}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Code2 className="h-4 w-4" />
            Code
            <Badge variant="secondary" className="ml-1">
              {declared.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {enriched.map((entry, index) => {
            if (entry.github) {
              return <GitHubRepoCard key={`gh-${String(index)}`} repo={entry.github} />;
            }
            if (entry.gitlab) {
              return <GitLabProjectCard key={`gl-${String(index)}`} project={entry.gitlab} />;
            }
            return null;
          })}

          {/* Whatever Chive could not fetch -- a Tangled repository addressed by
              record, a platform with no API -- still renders from the record. */}
          {plain.length > 0 && (
            <RepositoriesPanel
              repositories={{ code: plain }}
              only={['code']}
              title="Code"
              className="border-0 shadow-none [&>div:first-child]:hidden"
            />
          )}

          {archives.length > 0 && (
            <section className="space-y-2 pt-1">
              <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Archive className="h-3.5 w-3.5" />
                Archival
              </h4>
              {archives.map((swh, index) => (
                <SoftwareHeritageBadge key={`swh-${String(index)}`} data={swh} variant="card" />
              ))}
            </section>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
