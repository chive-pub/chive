/**
 * Tests for rendering one kind of resource, and for legacy platform fields.
 *
 * @remarks
 * Code and data have their own tabs on the eprint page, so the panel has to be
 * able to show a single kind. It previously rendered every kind in one card at
 * the bottom of the Metadata tab, where a paper's repositories were effectively
 * unfindable.
 *
 * @packageDocumentation
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RepositoriesPanel } from '@/components/eprints/repositories-panel';

/**
 * The shape real records use. Older ones carry `platform` where the lexicon
 * says `platformSlug`, and both appear in people's repositories.
 */
const repositories = {
  code: [{ url: 'https://github.com/wgantt/SEAMuS', label: 'SEAMuS code', platformSlug: 'github' }],
  data: [{ url: 'https://osf.io/abc', label: 'Stimuli', platformSlug: 'osf' }],
} as unknown as Parameters<typeof RepositoriesPanel>[0]['repositories'];

describe('RepositoriesPanel filtering', () => {
  it('shows every kind when not filtered', () => {
    render(<RepositoriesPanel repositories={repositories} />);

    expect(screen.getByText('SEAMuS code')).toBeInTheDocument();
    expect(screen.getByText('Stimuli')).toBeInTheDocument();
  });

  it('shows only the requested kind', () => {
    render(<RepositoriesPanel repositories={repositories} only={['code']} />);

    expect(screen.getByText('SEAMuS code')).toBeInTheDocument();
    expect(screen.queryByText('Stimuli')).not.toBeInTheDocument();
  });

  it('renders nothing when the requested kind is absent', () => {
    // An eprint with only code must not be given an empty Data tab.
    const { container } = render(
      <RepositoriesPanel repositories={repositories} only={['materials']} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there are no repositories at all', () => {
    const { container } = render(<RepositoriesPanel repositories={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('takes a caller-supplied heading', () => {
    render(<RepositoriesPanel repositories={repositories} only={['data']} title="Data" />);
    expect(screen.getByText('Data')).toBeInTheDocument();
  });
});

describe('legacy platform field', () => {
  it('recognises a record that names the platform `platform`', () => {
    // Records written before the lexicon settled on `platformSlug` carry
    // `platform`. Chive does not rewrite user records, so these persist; read
    // only the new name and every one of them falls back to a generic icon.
    const legacy = {
      code: [{ url: 'https://github.com/wgantt/SEAMuS', platform: 'github' }],
    } as unknown as Parameters<typeof RepositoriesPanel>[0]['repositories'];

    render(<RepositoriesPanel repositories={legacy} only={['code']} />);

    // With no label, the card falls back to the platform's own name — which it
    // can only know if it read the legacy field.
    expect(screen.getAllByText('GitHub').length).toBeGreaterThan(0);
  });

  it('still links a repository whose platform is unrecognised', () => {
    const unknown = {
      code: [{ url: 'https://example.org/repo', label: 'Somewhere else' }],
    } as unknown as Parameters<typeof RepositoriesPanel>[0]['repositories'];

    render(<RepositoriesPanel repositories={unknown} only={['code']} />);

    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://example.org/repo');
  });
});

describe('RepositoriesPanel link detail', () => {
  it('shows which repository a card means, not merely which service', () => {
    // A card headed "GitHub" said less than the URL it was built from already
    // knew. The address was in the record the whole time; it was not shown.
    render(
      <RepositoriesPanel
        only={['code']}
        repositories={{
          code: [
            {
              url: 'https://github.com/aaronstevenwhite/chive.git',
              label: 'Chive',
              platformSlug: 'github',
            },
          ],
        }}
      />
    );
    expect(screen.getByText('github.com/aaronstevenwhite/chive')).toBeInTheDocument();
  });

  it('shows a DOI alongside the address when the record carries one', () => {
    render(
      <RepositoriesPanel
        only={['data']}
        repositories={{
          data: [
            {
              url: 'https://zenodo.org/records/123',
              label: 'Stimuli',
              platformSlug: 'zenodo',
              doi: '10.5281/zenodo.123',
            },
          ],
        }}
      />
    );
    expect(screen.getByText('DOI: 10.5281/zenodo.123')).toBeInTheDocument();
  });
});

describe('RepositoriesPanel entries without an address', () => {
  it('renders an entry the author labelled but gave no address', () => {
    // The tab count counts these, so dropping the card left a tab reading
    // "Code 2" above one card.
    render(
      <RepositoriesPanel
        only={['code']}
        repositories={{
          code: [
            { url: 'https://github.com/a/b', label: 'Real repo', platformSlug: 'github' },
            { label: 'Probe repo on Tangled', platformSlug: 'tangled' },
          ],
        }}
      />
    );
    expect(screen.getByText('Real repo')).toBeInTheDocument();
    expect(screen.getByText('Probe repo on Tangled')).toBeInTheDocument();
    expect(screen.getByText('No address on the record')).toBeInTheDocument();
    // It says so rather than offering a link that goes nowhere.
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
