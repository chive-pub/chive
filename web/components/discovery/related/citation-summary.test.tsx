/**
 * Tests for the citation summary shown on an eprint's Network tab.
 *
 * @remarks
 * Two faults this covers, both of which shipped:
 *
 * Rows were labelled with the bare AT-URI. The graph beside it had already been
 * taught to name papers, but this list had its own rendering and kept showing
 * `at://did:plc:.../pub.chive.eprint.submission/...`.
 *
 * And the section headers counted the rows they had fetched rather than the
 * rows that exist, so a paper with eleven references announced "11 references"
 * in one line and "References (5)" in the next.
 *
 * And the link out pointed at `/eprints/<uri>/citations`, a route that cannot
 * exist: a Next.js catch-all has to be the last part of a route, so the path
 * fell through to `/eprints/[...uri]` with `citations` as a trailing segment
 * and the page asked the API for an AT-URI that was not one.
 *
 * @packageDocumentation
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CitationSummary } from '@/components/discovery/related/citation-summary';

const EPRINT = 'at://did:plc:me/pub.chive.eprint.submission/self';
const CITING = 'at://did:plc:other/pub.chive.eprint.submission/citing';
const CITED = 'at://did:plc:other/pub.chive.eprint.submission/cited';

const data = {
  eprint: { uri: EPRINT, title: 'The Paper' },
  counts: { citedByCount: 2, referencesCount: 11, influentialCitedByCount: 0 },
  citations: [
    { citingUri: CITING, citedUri: EPRINT, isInfluential: false, source: 'grobid' },
    { citingUri: EPRINT, citedUri: CITED, isInfluential: false, source: 'grobid' },
  ],
  papers: [
    { uri: CITING, title: 'Neural Models of Factuality', authors: ['Rachel Rudinger'], year: 2018 },
    { uri: CITED, title: 'Semantic Proto-Roles', authors: ['Drew Reisinger'], year: 2015 },
  ],
  hasMore: true,
};

vi.mock('@/lib/hooks/use-discovery', () => ({
  useCitations: () => ({ data, isLoading: false, isError: false }),
}));

describe('CitationSummary', () => {
  it('names each paper rather than printing its AT-URI', () => {
    render(<CitationSummary eprintUri={EPRINT} defaultOpen />);

    expect(screen.getByText(/Rudinger 2018 — Neural Models of Factuality/)).toBeInTheDocument();
    expect(screen.getByText(/Reisinger 2015 — Semantic Proto-Roles/)).toBeInTheDocument();
  });

  it('shows no bare AT-URI anywhere in the list', () => {
    const { container } = render(<CitationSummary eprintUri={EPRINT} defaultOpen />);

    expect(container.textContent).not.toContain('at://did:plc:other');
  });

  it('renders every citation it was given, not a sample', () => {
    // A network showing five of eleven references is one a reader cannot use:
    // the missing six are the ones they would have gone looking for.
    render(<CitationSummary eprintUri={EPRINT} defaultOpen />);

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(data.citations.length);
  });

  it('links to a citation network route that exists', () => {
    // `/eprints/<uri>/citations` matched the eprint catch-all with `citations`
    // as an extra segment, so the page asked for `at://.../xyz/citations` and
    // the API answered "uri must be a valid at-uri".
    render(<CitationSummary eprintUri={EPRINT} defaultOpen />);

    const link = screen.getByRole('link', { name: /Open the citation network/ });
    expect(link).toHaveAttribute('href', `/eprints/citations/${encodeURIComponent(EPRINT)}`);
  });

  it('counts the references that exist, not the ones it fetched', () => {
    // The list is capped; the header is not. Reporting the fetched length here
    // made the same paper claim 11 references and 1 reference in adjacent lines.
    render(<CitationSummary eprintUri={EPRINT} defaultOpen />);

    expect(screen.getByText('References (11)')).toBeInTheDocument();
    expect(screen.getByText('Cited by (2)')).toBeInTheDocument();
  });
});
