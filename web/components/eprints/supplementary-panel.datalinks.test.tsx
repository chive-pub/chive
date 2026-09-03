import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';

import { SupplementaryPanel } from './supplementary-panel';
import type { DataLinkItem } from './supplementary-panel';

const corpus: DataLinkItem = {
  uri: 'at://did:plc:author/pub.layers.eprint.dataLink/1',
  dataKind: 'corpus',
  description: 'Annotated sentences used for the main experiment.',
  paperSection: 'Table 3',
};

describe('SupplementaryPanel data links', () => {
  it('renders linked datasets when there are no uploaded materials', () => {
    render(<SupplementaryPanel items={[]} dataLinks={[corpus]} />);

    expect(screen.getByText('Corpus')).toBeInTheDocument();
    expect(screen.getByText(/Annotated sentences/)).toBeInTheDocument();
  });

  it('shows the paper section, which is what makes a dataset findable', () => {
    render(<SupplementaryPanel items={[]} dataLinks={[corpus]} />);

    expect(screen.getByText('Table 3')).toBeInTheDocument();
  });

  it('omits the section badge when Layers recorded none', () => {
    render(<SupplementaryPanel items={[]} dataLinks={[{ ...corpus, paperSection: undefined }]} />);

    expect(screen.queryByText('Table 3')).not.toBeInTheDocument();
    expect(screen.getByText('Corpus')).toBeInTheDocument();
  });

  it('labels a known data kind slug in prose', () => {
    render(
      <SupplementaryPanel items={[]} dataLinks={[{ ...corpus, dataKind: 'annotation-layer' }]} />
    );

    expect(screen.getByText('Annotation layer')).toBeInTheDocument();
  });

  it('shows an unrecognized data kind verbatim rather than dropping it', () => {
    render(<SupplementaryPanel items={[]} dataLinks={[{ ...corpus, dataKind: 'eye-tracking' }]} />);

    expect(screen.getByText('eye-tracking')).toBeInTheDocument();
  });

  it('renders nothing when there are neither materials nor datasets', () => {
    const { container } = render(<SupplementaryPanel items={[]} dataLinks={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders every linked dataset', () => {
    render(
      <SupplementaryPanel
        items={[]}
        dataLinks={[
          corpus,
          {
            ...corpus,
            uri: 'at://did:plc:author/pub.layers.eprint.dataLink/2',
            dataKind: 'model-output',
          },
        ]}
      />
    );

    expect(screen.getByText('Corpus')).toBeInTheDocument();
    expect(screen.getByText('Model output')).toBeInTheDocument();
  });

  it('offers a dataset link the collection loader, not the corpus loader', async () => {
    // The panel and the snippet have to agree on which ref names the data. A
    // dataset whose link carries only a catalogRef used to render as a label
    // with no way to reach it, because the snippet looked for a corpusRef.
    const user = userEvent.setup();
    render(
      <SupplementaryPanel
        items={[]}
        dataLinks={[
          {
            uri: 'at://did:plc:author/pub.layers.eprint.dataLink/3',
            dataKind: 'dataset',
            catalogRef: 'at://did:plc:mega/pub.layers.catalog.collection/acceptability',
          },
        ]}
      />
    );

    expect(screen.getByText('Dataset')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /load in python/i }));

    const code = screen.getByText(/PdsClient/);
    expect(code.textContent).toContain('load_collection');
    expect(code.textContent).toContain('pub.layers.catalog.collection/acceptability');
  });
});
