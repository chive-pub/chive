/**
 * Tests for ErrorCard component.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ErrorCard } from './error-card';

describe('ErrorCard', () => {
  it('renders with default title and message', () => {
    render(<ErrorCard />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
  });

  it('renders with custom title and message', () => {
    render(<ErrorCard title="Custom Error" message="Custom error message" />);

    expect(screen.getByText('Custom Error')).toBeInTheDocument();
    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('renders error icon', () => {
    render(<ErrorCard />);

    // AlertCircle icon should be present (it renders as an SVG)
    const card = screen.getByText('Something went wrong').closest('.flex');
    expect(card?.querySelector('svg')).toBeInTheDocument();
  });

  describe('retry button', () => {
    it('does not show retry button when onRetry is not provided', () => {
      render(<ErrorCard />);

      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });

    it('shows retry button when onRetry is provided', () => {
      render(<ErrorCard onRetry={() => {}} />);

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('calls onRetry when button is clicked', () => {
      const onRetry = vi.fn();
      render(<ErrorCard onRetry={onRetry} />);

      fireEvent.click(screen.getByRole('button', { name: /try again/i }));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('disables button when isRetrying is true', () => {
      render(<ErrorCard onRetry={() => {}} isRetrying={true} />);

      const button = screen.getByRole('button', { name: /retrying/i });
      expect(button).toBeDisabled();
    });

    it('shows "Retrying..." text when isRetrying is true', () => {
      render(<ErrorCard onRetry={() => {}} isRetrying={true} />);

      expect(screen.getByText('Retrying...')).toBeInTheDocument();
    });

    it('shows "Try again" text when isRetrying is false', () => {
      render(<ErrorCard onRetry={() => {}} isRetrying={false} />);

      expect(screen.getByText('Try again')).toBeInTheDocument();
    });
  });

  describe('error details', () => {
    it('shows error details component when showDetails is true and error is provided', () => {
      const error = new Error('Test error message');
      render(<ErrorCard error={error} showDetails={true} />);

      // ErrorDetails renders a collapsible with "Debug Details" button
      expect(screen.getByText('Debug Details')).toBeInTheDocument();
    });

    it('does not show error details when showDetails is false', () => {
      const error = new Error('Test error message');
      render(<ErrorCard error={error} showDetails={false} />);

      // ErrorDetails component should not be rendered
      expect(screen.queryByText('Debug Details')).not.toBeInTheDocument();
    });

    it('does not show error details when error is not provided', () => {
      render(<ErrorCard showDetails={true} />);

      // No error details component should be rendered without an error
      expect(screen.queryByText('Debug Details')).not.toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('applies destructive styling to card', () => {
      render(<ErrorCard />);

      const card = screen.getByText('Something went wrong').closest('.border-destructive\\/50');
      expect(card).toBeInTheDocument();
    });
  });
});
