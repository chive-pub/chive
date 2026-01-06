import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { MobileNav } from './mobile-nav';

// Mock usePathname from next/navigation
const mockUsePathname = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

describe('MobileNav', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/');
  });

  it('renders menu toggle button', () => {
    render(<MobileNav />);

    const toggleButton = screen.getByRole('button', { name: 'Toggle menu' });
    expect(toggleButton).toBeInTheDocument();
  });

  it('opens navigation drawer when toggle is clicked', async () => {
    const user = userEvent.setup();

    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Toggle menu' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Chive')).toBeInTheDocument();
  });

  it('renders navigation groups in drawer', async () => {
    const user = userEvent.setup();

    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Toggle menu' }));

    // Chive logo link should be visible
    expect(screen.getByRole('link', { name: 'Chive' })).toBeInTheDocument();

    // Navigation groups should be visible
    expect(screen.getByRole('button', { name: 'Discover' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Community' })).toBeInTheDocument();
  });

  it('shows Discover links by default (expanded)', async () => {
    const user = userEvent.setup();

    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Toggle menu' }));

    // Discover section is expanded by default, so its links should be visible
    expect(screen.getByText('Preprints')).toBeInTheDocument();
    expect(screen.getByText('Browse')).toBeInTheDocument();
    expect(screen.getByText('Fields')).toBeInTheDocument();
  });

  it('closes drawer when link is clicked', async () => {
    const user = userEvent.setup();

    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Toggle menu' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Click on a link in the Discover section (expanded by default)
    await user.click(screen.getByText('Preprints'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes drawer when Chive logo link is clicked', async () => {
    const user = userEvent.setup();

    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Toggle menu' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Chive' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('highlights active link based on pathname', async () => {
    mockUsePathname.mockReturnValue('/preprints');
    const user = userEvent.setup();

    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Toggle menu' }));

    // Find the Preprints link within the Discover section (expanded by default)
    // The link contains both the label and description, so use partial text match
    const preprintsLink = screen.getByText('Preprints').closest('a');
    const browseLink = screen.getByText('Browse').closest('a');

    expect(preprintsLink).toHaveClass('text-foreground');
    expect(browseLink).toHaveClass('text-muted-foreground');
  });

  it('applies custom className to toggle button', () => {
    render(<MobileNav className="custom-toggle" />);

    const toggleButton = screen.getByRole('button', { name: 'Toggle menu' });
    expect(toggleButton).toHaveClass('custom-toggle');
  });

  it('has accessible dialog title', async () => {
    const user = userEvent.setup();

    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Toggle menu' }));

    const title = screen.getByText('Navigation Menu');
    expect(title).toBeInTheDocument();
    expect(title).toHaveClass('sr-only');
  });

  it('closes dialog when close button is clicked', async () => {
    const user = userEvent.setup();

    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Toggle menu' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
