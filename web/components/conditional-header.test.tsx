/**
 * Component tests for ConditionalHeader.
 *
 * @remarks
 * Tests that the header is hidden on the login page and shown on all other pages.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the SiteHeader component
vi.mock('@/components/navigation', () => ({
  SiteHeader: () => <header data-testid="site-header">Site Header</header>,
}));

// Mock usePathname
const mockUsePathname = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

import { ConditionalHeader } from './conditional-header';

describe('ConditionalHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Header Hidden on Login Page', () => {
    it('hides header on login page (/login)', () => {
      mockUsePathname.mockReturnValue('/login');
      render(<ConditionalHeader />);

      expect(screen.queryByTestId('site-header')).not.toBeInTheDocument();
    });
  });

  describe('Header Shown on Other Pages', () => {
    it('shows header on landing page (/)', () => {
      mockUsePathname.mockReturnValue('/');
      render(<ConditionalHeader />);

      expect(screen.getByTestId('site-header')).toBeInTheDocument();
    });

    it('shows header on dashboard (/dashboard)', () => {
      mockUsePathname.mockReturnValue('/dashboard');
      render(<ConditionalHeader />);

      expect(screen.getByTestId('site-header')).toBeInTheDocument();
    });

    it('shows header on submit (/submit)', () => {
      mockUsePathname.mockReturnValue('/submit');
      render(<ConditionalHeader />);

      expect(screen.getByTestId('site-header')).toBeInTheDocument();
    });

    it('shows header on governance (/governance)', () => {
      mockUsePathname.mockReturnValue('/governance');
      render(<ConditionalHeader />);

      expect(screen.getByTestId('site-header')).toBeInTheDocument();
    });

    it('shows header on eprint pages (/eprints/123)', () => {
      mockUsePathname.mockReturnValue('/eprints/123');
      render(<ConditionalHeader />);

      expect(screen.getByTestId('site-header')).toBeInTheDocument();
    });

    it('shows header on search page (/search)', () => {
      mockUsePathname.mockReturnValue('/search');
      render(<ConditionalHeader />);

      expect(screen.getByTestId('site-header')).toBeInTheDocument();
    });

    it('shows header on author pages (/authors/did:plc:123)', () => {
      mockUsePathname.mockReturnValue('/authors/did:plc:123');
      render(<ConditionalHeader />);

      expect(screen.getByTestId('site-header')).toBeInTheDocument();
    });

    it('shows header on settings (/settings)', () => {
      mockUsePathname.mockReturnValue('/settings');
      render(<ConditionalHeader />);

      expect(screen.getByTestId('site-header')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('shows header on paths that start with but are not exactly /login', () => {
      mockUsePathname.mockReturnValue('/login-callback');
      render(<ConditionalHeader />);

      expect(screen.getByTestId('site-header')).toBeInTheDocument();
    });

    it('shows header on nested paths under /login', () => {
      mockUsePathname.mockReturnValue('/login/details');
      render(<ConditionalHeader />);

      expect(screen.getByTestId('site-header')).toBeInTheDocument();
    });
  });
});
