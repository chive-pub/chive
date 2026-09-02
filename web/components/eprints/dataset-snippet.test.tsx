/**
 * Tests for the dataset loading snippet.
 *
 * @remarks
 * A linked dataset is addressed by an AT-URI, which says the data exists but
 * not how to open it. The snippet closes that gap with the corpus URI already
 * in place.
 *
 * @packageDocumentation
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DatasetSnippet } from '@/components/eprints/dataset-snippet';

const CORPUS = 'at://did:plc:myu6umexofclib2tvwn23gsc/pub.layers.corpus.corpus/92cfd1034bcef513';

describe('DatasetSnippet', () => {
  it('stays out of the way until asked', () => {
    render(<DatasetSnippet corpusRef={CORPUS} />);

    expect(screen.getByRole('button', { name: /load in python/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByText(/import lairs/)).not.toBeInTheDocument();
  });

  it('shows code carrying this corpus URI', async () => {
    const user = userEvent.setup();
    render(<DatasetSnippet corpusRef={CORPUS} />);

    await user.click(screen.getByRole('button', { name: /load in python/i }));

    const code = screen.getByText(/import lairs/);
    expect(code.textContent).toContain(CORPUS);
    // The call the lairs README documents, not an invented one.
    expect(code.textContent).toContain('lairs.load_corpus');
    expect(code.textContent).toContain('PdsClient');
    expect(code.textContent).toContain('source="pds"');
  });

  it('copies the same code it displays', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    // After `setup()`, which installs a clipboard stub of its own, and via
    // `defineProperty` because jsdom exposes `navigator.clipboard` as a getter.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(<DatasetSnippet corpusRef={CORPUS} />);
    await user.click(screen.getByRole('button', { name: /load in python/i }));
    await user.click(screen.getByRole('button', { name: /copy code/i }));

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).toContain(CORPUS);
    expect(writeText.mock.calls[0][0]).toContain('lairs.load_corpus');
  });

  it('can be collapsed again', async () => {
    const user = userEvent.setup();
    render(<DatasetSnippet corpusRef={CORPUS} />);

    await user.click(screen.getByRole('button', { name: /load in python/i }));
    await user.click(screen.getByRole('button', { name: /hide code/i }));

    expect(screen.queryByText(/import lairs/)).not.toBeInTheDocument();
  });
});
