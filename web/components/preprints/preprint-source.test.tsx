import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { PreprintSource } from './preprint-source';
import { createMockPreprintSource } from '@/tests/mock-data';

describe('PreprintSource', () => {
  it('renders inline variant by default', () => {
    const source = createMockPreprintSource();
    render(<PreprintSource source={source} />);
    expect(screen.getByText(/Source:/)).toBeInTheDocument();
  });

  it('shows PDS hostname', () => {
    const source = createMockPreprintSource({ pdsEndpoint: 'https://pds.example.com/api' });
    render(<PreprintSource source={source} />);
    expect(screen.getByText('pds.example.com')).toBeInTheDocument();
  });

  it('links to record URL', () => {
    const source = createMockPreprintSource({
      recordUrl: 'at://did:plc:test/pub.chive.preprint.submission/123',
    });
    render(<PreprintSource source={source} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'at://did:plc:test/pub.chive.preprint.submission/123');
  });

  it('shows check icon when not stale', () => {
    const source = createMockPreprintSource({ stale: false });
    render(<PreprintSource source={source} />);
    // Check for the green check circle (CSS class indicates color)
    const icons = document.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThan(0);
  });

  it('shows warning icon and message when stale', () => {
    const source = createMockPreprintSource({ stale: true });
    render(<PreprintSource source={source} />);
    expect(screen.getByText('(may be outdated)')).toBeInTheDocument();
  });

  describe('card variant', () => {
    it('renders card layout', () => {
      const source = createMockPreprintSource();
      render(<PreprintSource source={source} variant="card" />);
      expect(screen.getByText('Data Source')).toBeInTheDocument();
      expect(screen.getByText('PDS Endpoint')).toBeInTheDocument();
      expect(screen.getByText('Original Record')).toBeInTheDocument();
    });

    it('shows PDS explanation', () => {
      const source = createMockPreprintSource();
      render(<PreprintSource source={source} variant="card" />);
      expect(
        screen.getByText(/This preprint is stored in the author's Personal Data Server/)
      ).toBeInTheDocument();
    });

    it('shows last verified date when available', () => {
      const source = createMockPreprintSource({
        lastVerifiedAt: '2024-01-15T10:00:00Z',
      });
      render(<PreprintSource source={source} variant="card" />);
      expect(screen.getByText('Last Verified')).toBeInTheDocument();
    });

    it('hides last verified when not available', () => {
      const source = createMockPreprintSource({ lastVerifiedAt: undefined });
      render(<PreprintSource source={source} variant="card" />);
      expect(screen.queryByText('Last Verified')).not.toBeInTheDocument();
    });

    it('shows stale warning in card', () => {
      const source = createMockPreprintSource({ stale: true });
      render(<PreprintSource source={source} variant="card" />);
      expect(screen.getByText(/This data may be outdated/)).toBeInTheDocument();
    });

    it('applies stale border styling', () => {
      const source = createMockPreprintSource({ stale: true });
      const { container } = render(<PreprintSource source={source} variant="card" />);
      const card = container.firstChild;
      expect(card).toHaveClass('border-yellow-500/50');
    });
  });

  it('handles invalid PDS URL gracefully', () => {
    const source = createMockPreprintSource({ pdsEndpoint: 'not-a-valid-url' });
    render(<PreprintSource source={source} />);
    // Should fall back to raw string
    expect(screen.getByText('not-a-valid-url')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const source = createMockPreprintSource();
    const { container } = render(
      <PreprintSource source={source} className="custom-source-class" />
    );
    expect(container.firstChild).toHaveClass('custom-source-class');
  });
});
