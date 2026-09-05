/**
 * Tests for the shared link card.
 *
 * @remarks
 * Every link on an eprint page renders through this, so the contract worth
 * holding is that each optional field is genuinely optional and that the two
 * link modes stay distinct: a card with one destination is itself the link,
 * and a card with several never nests one anchor inside another.
 *
 * @packageDocumentation
 */

import { render, screen } from '@testing-library/react';
import { Github } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { ResourceCard } from './resource-card';

describe('ResourceCard', () => {
  it('renders with nothing but an icon and a title', () => {
    render(<ResourceCard icon={Github} title="Bare" />);
    expect(screen.getByText('Bare')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('makes the whole card one link when there is one destination', () => {
    render(<ResourceCard icon={Github} title="Repo" href="https://github.com/a/b" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://github.com/a/b');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveTextContent('Repo');
  });

  it('renders actions instead of wrapping, so no anchor nests inside another', () => {
    render(
      <ResourceCard
        icon={Github}
        title="Record"
        href="https://ignored.example"
        actions={[
          { label: 'Open in Leaflet', href: 'https://leaflet.pub/x' },
          { label: 'View record', href: 'https://pdsls.dev/at://x' },
        ]}
      />
    );
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      'https://leaflet.pub/x',
      'https://pdsls.dev/at://x',
    ]);
  });

  it('downloads rather than opening when an action says so', () => {
    render(
      <ResourceCard
        icon={Github}
        title="File"
        actions={[{ label: 'Download', href: 'https://pds.example/blob', download: true }]}
      />
    );
    const link = screen.getByRole('link', { name: /download/i });
    expect(link).toHaveAttribute('download');
    // A download that opens a tab first leaves an empty one behind.
    expect(link).not.toHaveAttribute('target');
  });

  it('shows badge, subtitle, description and stats when given them', () => {
    render(
      <ResourceCard
        icon={Github}
        title="chive"
        badge="GitHub"
        subtitle="github.com/aaronstevenwhite/chive"
        description="A decentralized eprint service."
        stats={[{ label: '12 stars' }, { label: 'MIT' }]}
      />
    );
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('github.com/aaronstevenwhite/chive')).toBeInTheDocument();
    expect(screen.getByText('A decentralized eprint service.')).toBeInTheDocument();
    expect(screen.getByText('12 stars')).toBeInTheDocument();
    expect(screen.getByText('MIT')).toBeInTheDocument();
  });

  it('lets a URI break anywhere, so a long one cannot widen the page', () => {
    render(
      <ResourceCard icon={Github} title="Record" subtitle="at://did:plc:x/c/r" subtitleMono />
    );
    expect(screen.getByText('at://did:plc:x/c/r').className).toContain('break-all');
  });

  it('will not wrap a card that carries something interactive of its own', () => {
    // A button nested inside a link is not something a browser can represent.
    render(
      <ResourceCard icon={Github} title="Dataset" href="https://example.org">
        <button type="button">Load in Python</button>
      </ResourceCard>
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('button', { name: 'Load in Python' })).toBeInTheDocument();
  });

  it('renders anything it is given below its own content', () => {
    render(
      <ResourceCard icon={Github} title="Dataset">
        <p>snippet</p>
      </ResourceCard>
    );
    expect(screen.getByText('snippet')).toBeInTheDocument();
  });
});
