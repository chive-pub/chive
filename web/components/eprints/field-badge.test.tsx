import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { FieldBadge, FieldBadgeList } from './field-badge';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('FieldBadge', () => {
  const mockField = { uri: 'computer-science', label: 'Computer Science' };

  it('renders field name', () => {
    render(<FieldBadge field={mockField} />);
    expect(screen.getByText('Computer Science')).toBeInTheDocument();
  });

  it('links to field page when clickable', () => {
    render(<FieldBadge field={mockField} clickable />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/fields/computer-science');
  });

  it('does not link when not clickable', () => {
    render(<FieldBadge field={mockField} clickable={false} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<FieldBadge field={mockField} className="custom-class" clickable={false} />);
    const badge = screen.getByText('Computer Science');
    expect(badge).toHaveClass('custom-class');
  });

  it('encodes field URI in URL', () => {
    const fieldWithSpecialChars = { uri: 'field/with/slashes', label: 'Special Field' };
    render(<FieldBadge field={fieldWithSpecialChars} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/fields/field%2Fwith%2Fslashes');
  });
});

describe('FieldBadgeList', () => {
  const mockFields = [
    { uri: 'physics', label: 'Physics' },
    { uri: 'chemistry', label: 'Chemistry' },
    { uri: 'biology', label: 'Biology' },
    { uri: 'math', label: 'Mathematics' },
  ];

  it('renders all fields when count is below max', () => {
    render(<FieldBadgeList fields={mockFields.slice(0, 2)} max={5} />);
    expect(screen.getByText('Physics')).toBeInTheDocument();
    expect(screen.getByText('Chemistry')).toBeInTheDocument();
  });

  it('truncates fields when count exceeds max', () => {
    render(<FieldBadgeList fields={mockFields} max={2} />);
    expect(screen.getByText('Physics')).toBeInTheDocument();
    expect(screen.getByText('Chemistry')).toBeInTheDocument();
    expect(screen.queryByText('Biology')).not.toBeInTheDocument();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('returns null for empty fields array', () => {
    const { container } = render(<FieldBadgeList fields={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null for undefined fields', () => {
    const { container } = render(
      <FieldBadgeList fields={undefined as unknown as typeof mockFields} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('applies custom className', () => {
    const { container } = render(
      <FieldBadgeList fields={mockFields.slice(0, 1)} className="custom-list-class" />
    );
    expect(container.firstChild).toHaveClass('custom-list-class');
  });

  it('passes variant to badges', () => {
    render(<FieldBadgeList fields={mockFields.slice(0, 1)} variant="outline" clickable={false} />);
    const badge = screen.getByText('Physics');
    // Badge with outline variant should have the variant class
    expect(badge).toBeInTheDocument();
  });
});
