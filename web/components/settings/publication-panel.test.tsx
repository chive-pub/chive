/**
 * Tests for the publication settings panel.
 *
 * @remarks
 * A publication is what a reader subscribes to. It lives in the author's own
 * repository, so this panel is the only way one gets created or renamed —
 * Chive cannot do either on their behalf.
 *
 * The url is not editable, and that is the invariant most worth holding: it is
 * what a publication is matched on and what existing subscriptions were written
 * against, so changing it would orphan every subscriber.
 *
 * @packageDocumentation
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { PublicationPanel } from '@/components/settings/publication-panel';

const find = vi.fn();
const create = vi.fn();
const update = vi.fn();
const getRecord = vi.fn();

vi.mock('@/lib/atproto/subscription-records', () => ({
  findPublication: (...a: unknown[]) => find(...a),
  createPublication: (...a: unknown[]) => create(...a),
  updatePublication: (...a: unknown[]) => update(...a),
  publicationUrlFor: (did: string) => `https://chive.pub/authors/${did}`,
}));

let user: unknown = { did: 'did:plc:me', displayName: 'A Person', handle: 'a.person' };

// One agent for the lifetime of the module, as the real hook returns. A fresh
// object per call would re-run the panel's load effect on every render and
// overwrite whatever the author had typed.
const stableAgent = {
  com: { atproto: { repo: { getRecord: (...a: unknown[]) => getRecord(...a) } } },
};

vi.mock('@/lib/auth', () => ({
  useAgent: () => stableAgent,
  useCurrentUser: () => user,
}));

describe('PublicationPanel', () => {
  beforeEach(() => {
    user = { did: 'did:plc:me', displayName: 'A Person', handle: 'a.person' };
    find.mockReset();
    create.mockReset().mockResolvedValue({ uri: 'at://did:plc:me/site.standard.publication/new' });
    update.mockReset().mockResolvedValue(undefined);
    getRecord.mockReset().mockResolvedValue({
      data: { value: { name: 'Existing Name', description: 'Existing description.' } },
    });
  });

  it('renders nothing when nobody is signed in', () => {
    user = null;
    const { container } = render(<PublicationPanel />);

    expect(container).toBeEmptyDOMElement();
  });

  it('says readers cannot subscribe when there is no publication', async () => {
    find.mockResolvedValue(undefined);
    render(<PublicationPanel />);

    expect(await screen.findByText(/cannot subscribe to your papers/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create publication/i })).toBeInTheDocument();
  });

  it('offers the display name as the default', async () => {
    find.mockResolvedValue(undefined);
    render(<PublicationPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toHaveValue('A Person');
    });
  });

  it('loads the existing publication for editing', async () => {
    find.mockResolvedValue('at://did:plc:me/site.standard.publication/1');
    render(<PublicationPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toHaveValue('Existing Name');
    });
    expect(screen.getByLabelText(/description/i)).toHaveValue('Existing description.');
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('never offers the url for editing', async () => {
    // Changing it would orphan every existing subscriber.
    find.mockResolvedValue('at://did:plc:me/site.standard.publication/1');
    render(<PublicationPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/url/i)).toBeNull();
  });

  it('creates one keyed on the author DID', async () => {
    find.mockResolvedValue(undefined);
    const u = userEvent.setup();
    render(<PublicationPanel />);

    await u.click(await screen.findByRole('button', { name: /create publication/i }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ url: 'https://chive.pub/authors/did:plc:me' })
      );
    });
  });

  it('updates rather than creating a second publication', async () => {
    find.mockResolvedValue('at://did:plc:me/site.standard.publication/1');
    const u = userEvent.setup();
    render(<PublicationPanel />);

    await u.click(await screen.findByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(update).toHaveBeenCalled();
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses to save an empty name', async () => {
    // `name` is required by the schema.
    find.mockResolvedValue(undefined);
    const u = userEvent.setup();
    render(<PublicationPanel />);

    const input = await screen.findByLabelText(/name/i);
    await u.clear(input);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create publication/i })).toBeDisabled();
    });
  });

  it('surfaces a failed write', async () => {
    find.mockResolvedValue(undefined);
    create.mockRejectedValue(new Error('PDS refused the record'));
    const u = userEvent.setup();
    render(<PublicationPanel />);

    await u.click(await screen.findByRole('button', { name: /create publication/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('PDS refused the record');
  });

  it('still lets an author create one when the repository could not be read', async () => {
    find.mockRejectedValue(new Error('offline'));
    render(<PublicationPanel />);

    expect(await screen.findByRole('button', { name: /create publication/i })).toBeInTheDocument();
  });
});
