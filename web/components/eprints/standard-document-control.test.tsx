/**
 * Tests for publishing an eprint's standard.site document after the fact.
 *
 * @remarks
 * The submission wizard offers to write one and an author may decline; every
 * paper submitted before that offer existed has none. Both arrive at an eprint
 * readers outside Chive cannot find, with resubmission the only way back.
 *
 * @packageDocumentation
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { StandardDocumentControl } from '@/components/eprints/standard-document-control';

const find = vi.fn();
const create = vi.fn();
const update = vi.fn();

vi.mock('@/lib/atproto/record-creator', () => ({
  findStandardDocumentForEprint: (...a: unknown[]) => find(...a),
  createStandardDocument: (...a: unknown[]) => create(...a),
  updateStandardDocument: (...a: unknown[]) => update(...a),
}));

let agent: unknown = { did: 'did:plc:me' };
vi.mock('@/lib/auth', () => ({
  useAgent: () => agent,
  useCurrentUser: () => ({ displayName: 'A Person', handle: 'a.person' }),
}));

vi.mock('@/lib/atproto/subscription-records', () => ({
  ensurePublication: () => Promise.resolve('at://did:plc:me/site.standard.publication/pub'),
}));

const EPRINT = 'at://did:plc:me/pub.chive.eprint.submission/paper';

describe('StandardDocumentControl', () => {
  beforeEach(() => {
    agent = { did: 'did:plc:me' };
    find.mockReset();
    create.mockReset().mockResolvedValue({ uri: 'at://did:plc:me/site.standard.document/new' });
    update.mockReset().mockResolvedValue(undefined);
  });

  it('offers to publish when the eprint has no document', async () => {
    find.mockResolvedValue(undefined);
    render(<StandardDocumentControl eprintUri={EPRINT} title="A Paper" />);

    expect(
      await screen.findByRole('button', { name: /publish to standard\.site/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/cannot find this paper/i)).toBeInTheDocument();
  });

  it('writes the document when asked', async () => {
    find.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<StandardDocumentControl eprintUri={EPRINT} title="A Paper" description="Abstract." />);

    await user.click(await screen.findByRole('button', { name: /publish/i }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ eprintUri: EPRINT, title: 'A Paper', description: 'Abstract.' })
      );
    });
  });

  it('offers nothing further when the document already matches', async () => {
    // An "update" that changes nothing wastes a write and the author's time.
    find.mockResolvedValue({
      uri: 'at://x/y/z',
      title: 'A Paper',
      description: 'Abstract.',
      site: 'at://did:plc:me/site.standard.publication/pub',
    });
    render(<StandardDocumentControl eprintUri={EPRINT} title="A Paper" description="Abstract." />);

    expect(await screen.findByText(/Published\./i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers a refresh when the title has drifted', async () => {
    find.mockResolvedValue({
      uri: 'at://x/y/z',
      title: 'The Old Title',
      site: 'at://did:plc:me/site.standard.publication/pub',
    });
    render(<StandardDocumentControl eprintUri={EPRINT} title="A New Title" />);

    expect(await screen.findByRole('button', { name: /refresh/i })).toBeInTheDocument();
    expect(screen.getByText(/no longer matches/i)).toBeInTheDocument();
  });

  it('updates rather than creating a second document', async () => {
    find.mockResolvedValue({
      uri: 'at://x/y/z',
      title: 'The Old Title',
      site: 'at://did:plc:me/site.standard.publication/pub',
    });
    const user = userEvent.setup();
    render(<StandardDocumentControl eprintUri={EPRINT} title="A New Title" />);

    await user.click(await screen.findByRole('button', { name: /refresh/i }));

    await waitFor(() => {
      expect(update).toHaveBeenCalled();
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('offers to attach a document that names a bare url', async () => {
    // Every document written before publications existed names
    // `https://chive.pub`. The schema reserves that form for loose documents,
    // and a reader cannot subscribe to the author from one.
    find.mockResolvedValue({
      uri: 'at://x/y/z',
      title: 'A Paper',
      site: 'https://chive.pub',
    });
    render(<StandardDocumentControl eprintUri={EPRINT} title="A Paper" />);

    expect(await screen.findByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('points the document at a publication when writing it', async () => {
    find.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<StandardDocumentControl eprintUri={EPRINT} title="A Paper" />);

    await user.click(await screen.findByRole('button', { name: /publish/i }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ siteUrl: 'at://did:plc:me/site.standard.publication/pub' })
      );
    });
  });

  it('renders nothing when nobody is signed in', async () => {
    agent = null;
    const { container } = render(<StandardDocumentControl eprintUri={EPRINT} title="A Paper" />);

    // Better than a control that cannot work.
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('surfaces a failed write', async () => {
    find.mockResolvedValue(undefined);
    create.mockRejectedValue(new Error('PDS refused the record'));
    const user = userEvent.setup();
    render(<StandardDocumentControl eprintUri={EPRINT} title="A Paper" />);

    await user.click(await screen.findByRole('button', { name: /publish/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('PDS refused the record');
  });
});
