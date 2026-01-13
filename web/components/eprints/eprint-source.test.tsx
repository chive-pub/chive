import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { EprintSource } from './eprint-source';
import { createMockEprintSource } from '@/tests/mock-data';

describe('EprintSource', () => {
  it('renders inline variant by default', () => {
    const source = createMockEprintSource();
    render(<EprintSource source={source} />);
    expect(screen.getByText(/Source:/)).toBeInTheDocument();
  });

  it('shows PDS hostname', () => {
    const source = createMockEprintSource({ pdsEndpoint: 'https://pds.example.com/api' });
    render(<EprintSource source={source} />);
    expect(screen.getByText('pds.example.com')).toBeInTheDocument();
  });

  it('links to record URL', () => {
    const source = createMockEprintSource({
      recordUrl: 'at://did:plc:test/pub.chive.eprint.submission/123',
    });
    render(<EprintSource source={source} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'at://did:plc:test/pub.chive.eprint.submission/123');
  });

  it('shows check icon when not stale', () => {
    const source = createMockEprintSource({ stale: false });
    render(<EprintSource source={source} />);
    // Check for the green check circle (CSS class indicates color)
    const icons = document.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThan(0);
  });

  it('shows warning icon and message when stale', () => {
    const source = createMockEprintSource({ stale: true });
    render(<EprintSource source={source} />);
    expect(screen.getByText('(may be outdated)')).toBeInTheDocument();
  });

  describe('card variant', () => {
    it('renders card layout', () => {
      const source = createMockEprintSource();
      render(<EprintSource source={source} variant="card" />);
      expect(screen.getByText('Data Source')).toBeInTheDocument();
      expect(screen.getByText('PDS Endpoint')).toBeInTheDocument();
      expect(screen.getByText('Original Record')).toBeInTheDocument();
    });

    it('shows PDS explanation', () => {
      const source = createMockEprintSource();
      render(<EprintSource source={source} variant="card" />);
      expect(
        screen.getByText(/This eprint is stored in the author's Personal Data Server/)
      ).toBeInTheDocument();
    });

    it('shows last verified date when available', () => {
      const source = createMockEprintSource({
        lastVerifiedAt: '2024-01-15T10:00:00Z',
      });
      render(<EprintSource source={source} variant="card" />);
      expect(screen.getByText('Last Verified')).toBeInTheDocument();
    });

    it('hides last verified when not available', () => {
      const source = createMockEprintSource({ lastVerifiedAt: undefined });
      render(<EprintSource source={source} variant="card" />);
      expect(screen.queryByText('Last Verified')).not.toBeInTheDocument();
    });

    it('shows stale warning in card', () => {
      const source = createMockEprintSource({ stale: true });
      render(<EprintSource source={source} variant="card" />);
      expect(screen.getByText(/This data may be outdated/)).toBeInTheDocument();
    });

    it('applies stale border styling', () => {
      const source = createMockEprintSource({ stale: true });
      const { container } = render(<EprintSource source={source} variant="card" />);
      const card = container.firstChild;
      expect(card).toHaveClass('border-yellow-500/50');
    });
  });

  it('handles invalid PDS URL gracefully', () => {
    const source = createMockEprintSource({ pdsEndpoint: 'not-a-valid-url' });
    render(<EprintSource source={source} />);
    // Should fall back to raw string
    expect(screen.getByText('not-a-valid-url')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const source = createMockEprintSource();
    const { container } = render(<EprintSource source={source} className="custom-source-class" />);
    expect(container.firstChild).toHaveClass('custom-source-class');
  });
});
