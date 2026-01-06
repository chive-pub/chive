import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { FieldExternalIds, FieldExternalIdsSkeleton } from './field-external-ids';
import { createMockExternalId } from '@/tests/mock-data';

describe('FieldExternalIds', () => {
  it('returns null for empty external IDs', () => {
    const { container } = render(<FieldExternalIds externalIds={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null for undefined external IDs', () => {
    // @ts-expect-error Testing undefined prop behavior
    const { container } = render(<FieldExternalIds externalIds={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders list variant by default', () => {
    const externalIds = [createMockExternalId({ source: 'wikidata', id: 'Q21198' })];
    render(<FieldExternalIds externalIds={externalIds} />);
    expect(screen.getByText('External Identifiers')).toBeInTheDocument();
  });

  it('shows Wikidata link', () => {
    const externalIds = [createMockExternalId({ source: 'wikidata', id: 'Q21198' })];
    render(<FieldExternalIds externalIds={externalIds} />);
    expect(screen.getByText('Wikidata')).toBeInTheDocument();
    expect(screen.getByText('Q21198')).toBeInTheDocument();
  });

  it('shows LCSH link', () => {
    const externalIds = [createMockExternalId({ source: 'lcsh', id: 'sh85029534' })];
    render(<FieldExternalIds externalIds={externalIds} />);
    expect(screen.getByText('LCSH')).toBeInTheDocument();
    expect(screen.getByText('sh85029534')).toBeInTheDocument();
  });

  it('shows FAST link', () => {
    const externalIds = [createMockExternalId({ source: 'fast', id: '872451' })];
    render(<FieldExternalIds externalIds={externalIds} />);
    expect(screen.getByText('FAST')).toBeInTheDocument();
    expect(screen.getByText('872451')).toBeInTheDocument();
  });

  it('shows MeSH link', () => {
    const externalIds = [createMockExternalId({ source: 'mesh', id: 'D003196' })];
    render(<FieldExternalIds externalIds={externalIds} />);
    expect(screen.getByText('MeSH')).toBeInTheDocument();
    expect(screen.getByText('D003196')).toBeInTheDocument();
  });

  it('shows arXiv link', () => {
    const externalIds = [createMockExternalId({ source: 'arxiv', id: 'cs.AI' })];
    render(<FieldExternalIds externalIds={externalIds} />);
    expect(screen.getByText('arXiv')).toBeInTheDocument();
    expect(screen.getByText('cs.AI')).toBeInTheDocument();
  });

  it('links to external URL when provided', () => {
    const externalIds = [
      createMockExternalId({
        source: 'wikidata',
        id: 'Q21198',
        url: 'https://www.wikidata.org/wiki/Q21198',
      }),
    ];
    render(<FieldExternalIds externalIds={externalIds} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://www.wikidata.org/wiki/Q21198');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('generates default URL when not provided', () => {
    const externalIds = [
      createMockExternalId({ source: 'wikidata', id: 'Q21198', url: undefined }),
    ];
    render(<FieldExternalIds externalIds={externalIds} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://www.wikidata.org/wiki/Q21198');
  });

  it('renders multiple external IDs', () => {
    const externalIds = [
      createMockExternalId({ source: 'wikidata', id: 'Q21198' }),
      createMockExternalId({ source: 'lcsh', id: 'sh85029534' }),
    ];
    render(<FieldExternalIds externalIds={externalIds} />);
    expect(screen.getByText('Wikidata')).toBeInTheDocument();
    expect(screen.getByText('LCSH')).toBeInTheDocument();
  });

  describe('badges variant', () => {
    it('renders as badges', () => {
      const externalIds = [createMockExternalId({ source: 'wikidata', id: 'Q21198' })];
      render(<FieldExternalIds externalIds={externalIds} variant="badges" />);
      const link = screen.getByRole('link');
      expect(link).toHaveClass('rounded-full');
    });
  });

  describe('compact variant', () => {
    it('renders compact display', () => {
      const externalIds = [createMockExternalId({ source: 'wikidata', id: 'Q21198' })];
      render(<FieldExternalIds externalIds={externalIds} variant="compact" />);
      expect(screen.getByText('Wikidata')).toBeInTheDocument();
      // Compact doesn't show the full ID, check title attribute
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('title', 'Wikidata: Q21198');
    });
  });

  it('applies custom className', () => {
    const externalIds = [createMockExternalId({ source: 'wikidata', id: 'Q21198' })];
    const { container } = render(
      <FieldExternalIds externalIds={externalIds} className="custom-ext-class" />
    );
    expect(container.firstChild).toHaveClass('custom-ext-class');
  });
});

describe('FieldExternalIdsSkeleton', () => {
  it('renders skeleton with loading animation', () => {
    const { container } = render(<FieldExternalIdsSkeleton />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders correct number of items', () => {
    const { container } = render(<FieldExternalIdsSkeleton count={5} />);
    // One for the header plus 5 items
    expect(container.querySelectorAll('.animate-pulse').length).toBe(6);
  });

  it('applies custom className', () => {
    const { container } = render(<FieldExternalIdsSkeleton className="custom-skeleton" />);
    expect(container.firstChild).toHaveClass('custom-skeleton');
  });
});
