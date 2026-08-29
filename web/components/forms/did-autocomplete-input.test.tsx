/**
 * Tests for the Chive-author branch of the DID autocomplete.
 *
 * @remarks
 * These pin the label shown for a Chive author. The component previously read
 * `hasEprints`, which `pub.chive.author.searchAuthors` does not return, so
 * every Chive author was described as "Has Chive profile" whether or not they
 * had eprints.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DidAutocompleteInput } from './did-autocomplete-input';

const { mockSearchAuthors } = vi.hoisted(() => ({ mockSearchAuthors: vi.fn() }));

vi.mock('@/lib/api/client', () => ({
  api: {
    pub: { chive: { author: { searchAuthors: mockSearchAuthors, getProfile: vi.fn() } } },
  },
}));

function author(overrides: Record<string, unknown> = {}) {
  return {
    did: 'did:plc:alice',
    handle: 'alice.bsky.social',
    displayName: 'Alice',
    ...overrides,
  };
}

describe('DidAutocompleteInput Chive author results', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports how many eprints an author has', async () => {
    mockSearchAuthors.mockResolvedValue({ data: { authors: [author({ eprintCount: 4 })] } });
    const user = userEvent.setup();

    render(<DidAutocompleteInput onSelect={vi.fn()} />);
    await user.type(screen.getByRole('textbox'), 'alice');

    expect(await screen.findByText('4 eprints on Chive')).toBeInTheDocument();
  });

  it('says one eprint in the singular', async () => {
    mockSearchAuthors.mockResolvedValue({ data: { authors: [author({ eprintCount: 1 })] } });
    const user = userEvent.setup();

    render(<DidAutocompleteInput onSelect={vi.fn()} />);
    await user.type(screen.getByRole('textbox'), 'alice');

    expect(await screen.findByText('1 eprint on Chive')).toBeInTheDocument();
  });

  it('falls back to the profile label when an author has no eprints', async () => {
    mockSearchAuthors.mockResolvedValue({ data: { authors: [author({ eprintCount: 0 })] } });
    const user = userEvent.setup();

    render(<DidAutocompleteInput onSelect={vi.fn()} />);
    await user.type(screen.getByRole('textbox'), 'alice');

    expect(await screen.findByText('Has Chive profile')).toBeInTheDocument();
  });

  it('falls back when the count is absent rather than showing NaN', async () => {
    mockSearchAuthors.mockResolvedValue({ data: { authors: [author()] } });
    const user = userEvent.setup();

    render(<DidAutocompleteInput onSelect={vi.fn()} />);
    await user.type(screen.getByRole('textbox'), 'alice');

    expect(await screen.findByText('Has Chive profile')).toBeInTheDocument();
  });

  it('asks Chive through the typed client', async () => {
    mockSearchAuthors.mockResolvedValue({ data: { authors: [author({ eprintCount: 2 })] } });
    const user = userEvent.setup();

    render(<DidAutocompleteInput onSelect={vi.fn()} />);
    await user.type(screen.getByRole('textbox'), 'alice');

    await screen.findByText('2 eprints on Chive');
    expect(mockSearchAuthors).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'alice', limit: 8 }),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});
