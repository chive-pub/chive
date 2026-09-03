/**
 * Tests for dataset references addressed by AT-URI.
 *
 * @remarks
 * A dataset published on Layers has no web address: Layers' web routing is not
 * settled, and the record is the durable identifier. So its AT-URI is stored in
 * `repositories.data[].url`, a field declared as a URI and rendered as a link.
 * An `at://` value is a valid URI but not one a browser can open, so rendering
 * it as an anchor produces a link that silently does nothing.
 *
 * The fixtures below are the real values from the neg-raising submission.
 *
 * @packageDocumentation
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { RepositoriesPanel } from '@/components/eprints/repositories-panel';

const NEGRAISING =
  'at://did:plc:7mkpigmjivtcraazolk3hsmx/pub.layers.catalog.collection/95d95ff061ace2f8f35bff07';
const ACCEPTABILITY =
  'at://did:plc:35obunpybbl75wyyk2pku4lp/pub.layers.catalog.collection/af3290c1ae3d2e180973d565';

function panel() {
  return (
    <RepositoriesPanel
      only={['data']}
      title="Data"
      repositories={{
        data: [
          { url: NEGRAISING, label: 'MegaNegRaising', platformSlug: 'other' },
          { url: ACCEPTABILITY, label: 'MegaAcceptability v2', platformSlug: 'other' },
        ],
      }}
    />
  );
}

describe('RepositoriesPanel with AT-URI datasets', () => {
  it('does not render a link a browser cannot follow', () => {
    render(panel());

    for (const link of screen.queryAllByRole('link')) {
      expect(link.getAttribute('href')).not.toMatch(/^at:\/\//);
    }
  });

  it('names each dataset by its label', () => {
    render(panel());

    expect(screen.getByText('MegaNegRaising')).toBeInTheDocument();
    expect(screen.getByText('MegaAcceptability v2')).toBeInTheDocument();
  });

  it('attributes them to Layers rather than to "Other"', () => {
    render(panel());

    expect(screen.getAllByText('Layers')).toHaveLength(2);
    expect(screen.queryByText('Other')).not.toBeInTheDocument();
  });

  it('shows the AT-URI, which is the identifier a reader can act on', () => {
    render(panel());

    expect(screen.getByText(NEGRAISING)).toBeInTheDocument();
  });

  it('offers code that loads the dataset', async () => {
    const user = userEvent.setup();
    render(panel());

    await user.click(screen.getAllByRole('button', { name: /load in python/i })[0]);

    const code = screen.getByText(/PdsClient/);
    expect(code.textContent).toContain('load_collection');
    expect(code.textContent).toContain(NEGRAISING);
  });

  it('reads a dataset from recordUri, the field that means a record', async () => {
    // `url` is declared a URI and described "Repository URL"; an at:// is not
    // an address a browser can open. `recordUri` is where a record reference
    // belongs, and the code-repository shape has had one all along.
    const user = userEvent.setup();
    render(
      <RepositoriesPanel
        only={['data']}
        repositories={{
          data: [{ recordUri: NEGRAISING, label: 'MegaNegRaising', platformSlug: 'other' }],
        }}
      />
    );

    expect(screen.getByText('MegaNegRaising')).toBeInTheDocument();
    expect(screen.getByText(NEGRAISING)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /load in python/i }));
    expect(screen.getByText(/PdsClient/).textContent).toContain('load_collection');
  });

  it('prefers recordUri when a record carries both', () => {
    // A dataset may have a web page as well as a record. The record is the
    // durable identifier, so it is the one the card acts on.
    render(
      <RepositoriesPanel
        only={['data']}
        repositories={{
          data: [
            {
              url: 'https://example.org/dataset',
              recordUri: NEGRAISING,
              label: 'MegaNegRaising',
              platformSlug: 'other',
            },
          ],
        }}
      />
    );

    expect(screen.getByText(NEGRAISING)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('still renders an ordinary web repository as a link', () => {
    render(
      <RepositoriesPanel
        only={['data']}
        repositories={{
          data: [{ url: 'https://osf.io/abc123', label: 'OSF project', platformSlug: 'osf' }],
        }}
      />
    );

    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://osf.io/abc123');
  });
});
