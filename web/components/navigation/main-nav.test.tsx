import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { MainNav } from './main-nav';

// Mock usePathname from next/navigation
const mockUsePathname = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

describe('MainNav', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/');
  });

  it('renders navigation triggers', () => {
    render(<MainNav />);

    expect(screen.getByRole('button', { name: 'Discover' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Community' })).toBeInTheDocument();
  });

  it('shows Discover links when trigger is clicked', async () => {
    const user = userEvent.setup();

    render(<MainNav />);

    await user.click(screen.getByRole('button', { name: 'Discover' }));

    expect(screen.getByText('Eprints')).toBeInTheDocument();
    expect(screen.getByText('Browse')).toBeInTheDocument();
    expect(screen.getByText('Fields')).toBeInTheDocument();
    expect(screen.getByText('Authors')).toBeInTheDocument();
    expect(screen.getByText('Trending')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
  });

  it('shows Community links when trigger is clicked', async () => {
    const user = userEvent.setup();

    render(<MainNav />);

    await user.click(screen.getByRole('button', { name: 'Community' }));

    expect(screen.getByText('Governance')).toBeInTheDocument();
    expect(screen.getByText('Authorities')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  it('has correct href attributes for Discover links', async () => {
    const user = userEvent.setup();

    render(<MainNav />);

    await user.click(screen.getByRole('button', { name: 'Discover' }));

    expect(screen.getByText('Eprints').closest('a')).toHaveAttribute('href', '/eprints');
    expect(screen.getByText('Browse').closest('a')).toHaveAttribute('href', '/browse');
    expect(screen.getByText('Fields').closest('a')).toHaveAttribute('href', '/fields');
    expect(screen.getByText('Authors').closest('a')).toHaveAttribute('href', '/authors');
  });

  it('highlights active link based on pathname', async () => {
    mockUsePathname.mockReturnValue('/eprints');
    const user = userEvent.setup();

    render(<MainNav />);

    await user.click(screen.getByRole('button', { name: 'Discover' }));

    const eprintsLink = screen.getByText('Eprints').closest('a');
    const browseLink = screen.getByText('Browse').closest('a');

    expect(eprintsLink).toHaveClass('bg-accent/50');
    expect(browseLink).not.toHaveClass('bg-accent/50');
  });

  it('highlights nested route correctly', async () => {
    mockUsePathname.mockReturnValue('/eprints/at://did:plc:test/123');
    const user = userEvent.setup();

    render(<MainNav />);

    await user.click(screen.getByRole('button', { name: 'Discover' }));

    const eprintsLink = screen.getByText('Eprints').closest('a');
    expect(eprintsLink).toHaveClass('bg-accent/50');
  });

  it('has navigation landmark', () => {
    render(<MainNav />);

    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<MainNav className="custom-class" />);

    expect(screen.getByRole('navigation')).toHaveClass('custom-class');
  });

  it('shows descriptions for nav items', async () => {
    const user = userEvent.setup();

    render(<MainNav />);

    await user.click(screen.getByRole('button', { name: 'Discover' }));

    expect(screen.getByText('Browse recent eprint submissions')).toBeInTheDocument();
    expect(screen.getByText('Explore with faceted classification')).toBeInTheDocument();
  });
});
