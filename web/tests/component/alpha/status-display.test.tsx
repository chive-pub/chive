/**
 * Component tests for AlphaStatusDisplay.
 *
 * @remarks
 * Tests the status display component for different application states.
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';

import { AlphaStatusDisplay } from '@/components/alpha/status-display';
import { renderWithProviders } from '../../test-utils';

describe('AlphaStatusDisplay', () => {
  describe('Pending Status', () => {
    it('renders pending state correctly', () => {
      renderWithProviders(<AlphaStatusDisplay status="pending" />);

      expect(screen.getByText(/under review/i)).toBeInTheDocument();
      expect(screen.getByText(/reviewing applications/i)).toBeInTheDocument();
    });

    it('shows applied date when provided', () => {
      renderWithProviders(<AlphaStatusDisplay status="pending" appliedAt="2024-01-15T10:00:00Z" />);

      expect(screen.getByText(/applied on/i)).toBeInTheDocument();
      expect(screen.getByText(/january 15, 2024/i)).toBeInTheDocument();
    });

    it('renders clock icon for pending', () => {
      const { container } = renderWithProviders(<AlphaStatusDisplay status="pending" />);

      // Check for amber-colored icon (Clock component)
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Approved Status', () => {
    it('renders approved state correctly', () => {
      renderWithProviders(<AlphaStatusDisplay status="approved" />);

      expect(screen.getByText(/welcome to the alpha/i)).toBeInTheDocument();
      expect(screen.getByText(/full access/i)).toBeInTheDocument();
    });

    it('shows reviewed date when provided', () => {
      renderWithProviders(
        <AlphaStatusDisplay status="approved" reviewedAt="2024-01-16T10:00:00Z" />
      );

      expect(screen.getByText(/approved on/i)).toBeInTheDocument();
      expect(screen.getByText(/january 16, 2024/i)).toBeInTheDocument();
    });

    it('has green styling for approved', () => {
      const { container } = renderWithProviders(<AlphaStatusDisplay status="approved" />);

      // Check for green-themed card
      const card = container.querySelector('.border-green-200, .bg-green-50');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Rejected Status (shown as pending)', () => {
    it('renders rejected as pending state', () => {
      renderWithProviders(<AlphaStatusDisplay status="rejected" />);

      // Should show pending-style messaging, NOT rejected
      expect(screen.getByText(/under review/i)).toBeInTheDocument();
      expect(screen.getByText(/reviewing applications/i)).toBeInTheDocument();
    });

    it('never shows rejection messaging', () => {
      renderWithProviders(<AlphaStatusDisplay status="rejected" />);

      // These should NOT be present for rejected status
      expect(screen.queryByText(/not approved/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/rejected/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/declined/i)).not.toBeInTheDocument();
    });

    it('shows applied date when provided (not reviewed)', () => {
      renderWithProviders(
        <AlphaStatusDisplay status="rejected" appliedAt="2024-01-15T10:00:00Z" />
      );

      // Should show applied date like pending, not reviewed date
      expect(screen.getByText(/applied on/i)).toBeInTheDocument();
      expect(screen.getByText(/january 15, 2024/i)).toBeInTheDocument();
    });

    it('renders clock icon like pending', () => {
      const { container } = renderWithProviders(<AlphaStatusDisplay status="rejected" />);

      // Check for icon (Clock component like pending)
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('pending card has proper structure', () => {
      renderWithProviders(<AlphaStatusDisplay status="pending" />);

      // Should have title
      expect(screen.getByText(/under review/i)).toBeInTheDocument();
    });

    it('approved card has proper structure', () => {
      renderWithProviders(<AlphaStatusDisplay status="approved" />);

      // Should have title
      expect(screen.getByText(/welcome to the alpha/i)).toBeInTheDocument();
    });

    it('rejected (shown as pending) card has proper structure', () => {
      renderWithProviders(<AlphaStatusDisplay status="rejected" />);

      // Should have title (same as pending)
      expect(screen.getByText(/under review/i)).toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('formats dates in US locale', () => {
      renderWithProviders(<AlphaStatusDisplay status="pending" appliedAt="2024-12-25T10:00:00Z" />);

      // Should format as "Month Day, Year"
      expect(screen.getByText(/december 25, 2024/i)).toBeInTheDocument();
    });

    it('handles invalid date gracefully', () => {
      // Component should not crash with invalid date
      expect(() => {
        renderWithProviders(<AlphaStatusDisplay status="pending" appliedAt="invalid-date" />);
      }).not.toThrow();
    });
  });
});
