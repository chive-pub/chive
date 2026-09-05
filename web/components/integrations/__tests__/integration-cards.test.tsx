/**
 * Tests for the integration cards.
 *
 * @remarks
 * These four cards each had their own layout, and the GitHub one was the only
 * one worth keeping. They now render through the page's shared card, so the
 * contract worth holding is that nothing that was informative was lost on the
 * way -- and, in particular, that an unreachable upstream still refuses to
 * print a placeholder count as though it were a measurement.
 *
 * @packageDocumentation
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DatasetLinkItem } from '../dataset-links';
import { GitHubRepoCard } from '../github-repo-card';
import { GitLabProjectCard } from '../gitlab-project-card';
import { SoftwareHeritageBadge } from '../software-heritage-badge';
import { ZenodoBadge } from '../zenodo-badge';

const REPO = {
  type: 'github' as const,
  owner: 'aaronstevenwhite',
  repo: 'chive',
  url: 'https://github.com/aaronstevenwhite/chive',
  stars: 1234,
  forks: 56,
  language: 'TypeScript',
  description: 'Decentralized eprints on ATProto',
  license: 'MIT',
  topics: ['atprotocol', 'eprints', 'open-science', 'preprints', 'a', 'b', 'c'],
  lastUpdated: '2026-09-01T00:00:00Z',
};

describe('GitHubRepoCard', () => {
  it('leads with the repository and reports what GitHub knows', () => {
    render(<GitHubRepoCard repo={REPO} />);
    expect(screen.getByText('aaronstevenwhite/chive')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Decentralized eprints on ATProto')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('56')).toBeInTheDocument();
    expect(screen.getByText('MIT')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', REPO.url);
  });

  it('caps the topics rather than growing the card without limit', () => {
    render(<GitHubRepoCard repo={REPO} />);
    expect(screen.getByText('atprotocol')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('refuses to print a placeholder count as a measurement', () => {
    render(<GitHubRepoCard repo={{ ...REPO, unavailable: true, stars: 0, forks: 0 }} />);
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.getByText(/could not be reached/i)).toBeInTheDocument();
  });
});

describe('GitLabProjectCard', () => {
  it('shows the project path, its visibility and its counts', () => {
    render(
      <GitLabProjectCard
        project={{
          type: 'gitlab',
          pathWithNamespace: 'group/project',
          name: 'project',
          url: 'https://gitlab.com/group/project',
          stars: 7,
          forks: 2,
          description: 'A project',
          visibility: 'public',
          topics: ['nlp'],
          lastActivityAt: '2026-09-01T00:00:00Z',
        }}
      />
    );
    expect(screen.getByText('group/project')).toBeInTheDocument();
    expect(screen.getByText('GitLab')).toBeInTheDocument();
    expect(screen.getByText('public')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('nlp')).toBeInTheDocument();
  });
});

describe('ZenodoBadge', () => {
  const RECORD = {
    type: 'zenodo' as const,
    doi: '10.5281/zenodo.123',
    title: 'Stimuli and analysis code',
    url: 'https://doi.org/10.5281/zenodo.123',
    resourceType: 'dataset',
    accessRight: 'open',
    version: '2',
    stats: { views: 900, downloads: 120 },
  };

  it('leads with the DOI and reports the deposit', () => {
    render(<ZenodoBadge record={RECORD} variant="card" />);
    expect(screen.getByText('10.5281/zenodo.123')).toBeInTheDocument();
    expect(screen.getByText('Zenodo')).toBeInTheDocument();
    expect(screen.getByText('Stimuli and analysis code')).toBeInTheDocument();
    expect(screen.getByText('dataset')).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getByText('900 views')).toBeInTheDocument();
    expect(screen.getByText('120 downloads')).toBeInTheDocument();
  });

  it('still renders the compact badge variant used elsewhere', () => {
    render(<ZenodoBadge record={RECORD} />);
    expect(screen.getByText('DOI')).toBeInTheDocument();
  });
});

describe('SoftwareHeritageBadge', () => {
  it('says what is archived and when it was last seen', () => {
    render(
      <SoftwareHeritageBadge
        variant="card"
        data={{
          type: 'software-heritage',
          originUrl: 'https://github.com/a/b',
          archived: true,
          lastVisit: '2026-01-15T00:00:00Z',
          lastSnapshotSwhid: 'swh:1:snp:0123456789abcdef0123456789abcdef01234567',
          browseUrl: 'https://archive.softwareheritage.org/browse/x',
        }}
      />
    );
    expect(screen.getByText('Software Heritage')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.getByText('https://github.com/a/b')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      'https://archive.softwareheritage.org/browse/x'
    );
  });

  it('says plainly when nothing is archived yet', () => {
    render(
      <SoftwareHeritageBadge
        variant="card"
        data={{ type: 'software-heritage', originUrl: 'https://github.com/a/b', archived: false }}
      />
    );
    expect(screen.getByText('Not yet archived')).toBeInTheDocument();
  });
});

describe('DatasetLinkItem', () => {
  it('leads with the deposit title rather than the repository name', () => {
    render(
      <DatasetLinkItem
        variant="card"
        dataset={{
          type: 'osf',
          title: 'Experiment 1 materials',
          url: 'https://osf.io/abc12',
          doi: '10.17605/OSF.IO/ABC12',
        }}
      />
    );
    expect(screen.getByText('Experiment 1 materials')).toBeInTheDocument();
    expect(screen.getByText('OSF')).toBeInTheDocument();
    expect(screen.getByText('osf.io/abc12')).toBeInTheDocument();
    expect(screen.getByText('DOI: 10.17605/OSF.IO/ABC12')).toBeInTheDocument();
  });
});
