/**
 * Tests for the dataset loading snippet.
 *
 * @remarks
 * A linked dataset is addressed by an AT-URI, which says the data exists but
 * not how to open it. The snippet closes that gap with the URI already in
 * place. Which loader it emits depends on what the link names: a catalog
 * collection is the dataset as a whole, a corpus is one part of one, and the
 * two have separate loaders in `lairs`.
 *
 * @packageDocumentation
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DatasetSnippet } from '@/components/eprints/dataset-snippet';

const CORPUS = 'at://did:plc:myu6umexofclib2tvwn23gsc/pub.layers.corpus.corpus/92cfd1034bcef513';
const CATALOG = 'at://did:plc:35obunpybbl75wyyk2pku4lp/pub.layers.catalog.collection/acceptability';

describe('DatasetSnippet', () => {
  it('stays out of the way until asked', () => {
    render(<DatasetSnippet corpusRef={CORPUS} />);

    expect(screen.getByRole('button', { name: /load in python/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByText(/PdsClient/)).not.toBeInTheDocument();
  });

  it('shows code carrying this corpus URI', async () => {
    const user = userEvent.setup();
    render(<DatasetSnippet corpusRef={CORPUS} />);

    await user.click(screen.getByRole('button', { name: /load in python/i }));

    const code = screen.getByText(/PdsClient/);
    expect(code.textContent).toContain(CORPUS);
    // The call the lairs README documents, not an invented one.
    expect(code.textContent).toContain('load_corpus');
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
    expect(writeText.mock.calls[0][0]).toContain('load_corpus');
  });

  it('can be collapsed again', async () => {
    const user = userEvent.setup();
    render(<DatasetSnippet corpusRef={CORPUS} />);

    await user.click(screen.getByRole('button', { name: /load in python/i }));
    await user.click(screen.getByRole('button', { name: /hide code/i }));

    expect(screen.queryByText(/import lairs/)).not.toBeInTheDocument();
  });

  it('loads a dataset as a collection, not as a corpus', async () => {
    // `pub.layers.catalog.collection` is the dataset artifact. A dataset built
    // from expressions and judgments has no corpus record at all, so emitting
    // load_corpus here would hand the reader a call with nothing to call it on.
    const user = userEvent.setup();
    render(<DatasetSnippet catalogRef={CATALOG} />);

    await user.click(screen.getByRole('button', { name: /load in python/i }));

    const code = screen.getByText(/PdsClient/);
    expect(code.textContent).toContain(CATALOG);
    expect(code.textContent).toContain('load_collection');
    expect(code.textContent).toContain('from lairs.data.collection import load_collection');
    expect(code.textContent).not.toContain('load_corpus');
  });

  it('prefers the dataset over one of its corpora', async () => {
    const user = userEvent.setup();
    render(<DatasetSnippet catalogRef={CATALOG} corpusRef={CORPUS} />);

    await user.click(screen.getByRole('button', { name: /load in python/i }));

    const code = screen.getByText(/PdsClient/);
    expect(code.textContent).toContain(CATALOG);
    expect(code.textContent).not.toContain(CORPUS);
  });

  it('renders nothing for a link that names no loadable record', () => {
    const { container } = render(<DatasetSnippet />);

    expect(container).toBeEmptyDOMElement();
  });
});
