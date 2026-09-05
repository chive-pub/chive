/**
 * Tests for the external identifiers panel.
 *
 * @remarks
 * The panel used to render a flat row -- a label, then a monospaced value --
 * which looked unlike every other link on the page for no reason a reader could
 * learn anything from. It now renders the page's standard card, with the
 * identifier leading and the address it resolves to beneath it.
 *
 * @packageDocumentation
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ExternalIdsPanel } from './external-ids-panel';

describe('ExternalIdsPanel', () => {
  it('renders nothing when there are no identifiers', () => {
    const { container } = render(<ExternalIdsPanel />);
    expect(container).toBeEmptyDOMElement();
    const empty = render(<ExternalIdsPanel externalIds={{}} />);
    expect(empty.container).toBeEmptyDOMElement();
  });

  it('leads with the identifier and names the service beside it', () => {
    render(<ExternalIdsPanel externalIds={{ arxivId: '2405.12345' }} />);
    expect(screen.getByText('2405.12345')).toBeInTheDocument();
    expect(screen.getByText('arXiv')).toBeInTheDocument();
  });

  it('says where the link goes before it is clicked', () => {
    render(<ExternalIdsPanel externalIds={{ arxivId: '2405.12345' }} />);
    expect(screen.getByText('arxiv.org/abs/2405.12345')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://arxiv.org/abs/2405.12345');
  });

  it('renders a display-only identifier without pretending it links somewhere', () => {
    render(<ExternalIdsPanel externalIds={{ magId: '99887766' }} />);
    expect(screen.getByText('99887766')).toBeInTheDocument();
    expect(screen.getByText('No public address')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('counts the identifiers it holds', () => {
    render(
      <ExternalIdsPanel externalIds={{ arxivId: '2405.12345', pmid: '12345678', osf: 'abc12' }} />
    );
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
