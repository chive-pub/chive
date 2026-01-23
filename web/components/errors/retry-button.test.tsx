/**
 * Tests for RetryButton component.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { RetryButton } from './retry-button';

describe('RetryButton', () => {
  it('renders with default label', () => {
    render(<RetryButton onRetry={() => {}} />);

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    render(<RetryButton onRetry={() => {}} label="Reload" />);

    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });

  it('calls onRetry when clicked', () => {
    const onRetry = vi.fn();
    render(<RetryButton onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('disables button when isRetrying is true', () => {
    render(<RetryButton onRetry={() => {}} isRetrying={true} />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows retrying label when isRetrying is true', () => {
    render(<RetryButton onRetry={() => {}} isRetrying={true} />);

    expect(screen.getByText('Retrying...')).toBeInTheDocument();
  });

  it('shows custom retrying label', () => {
    render(<RetryButton onRetry={() => {}} isRetrying={true} retryingLabel="Loading..." />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders RefreshCw icon', () => {
    render(<RetryButton onRetry={() => {}} />);

    const button = screen.getByRole('button');
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('applies animate-spin class when isRetrying is true', () => {
    render(<RetryButton onRetry={() => {}} isRetrying={true} />);

    const button = screen.getByRole('button');
    const svg = button.querySelector('svg');
    expect(svg?.classList.contains('animate-spin')).toBe(true);
  });

  it('does not apply animate-spin class when isRetrying is false', () => {
    render(<RetryButton onRetry={() => {}} isRetrying={false} />);

    const button = screen.getByRole('button');
    const svg = button.querySelector('svg');
    expect(svg?.classList.contains('animate-spin')).toBe(false);
  });

  it('uses outline variant by default', () => {
    render(<RetryButton onRetry={() => {}} />);

    const button = screen.getByRole('button');
    // Outline variant class pattern
    expect(button.className).toContain('border');
  });

  it('accepts custom variant', () => {
    render(<RetryButton onRetry={() => {}} variant="destructive" />);

    const button = screen.getByRole('button');
    expect(button.className).toContain('destructive');
  });

  it('passes through additional button props', () => {
    render(<RetryButton onRetry={() => {}} data-testid="custom-button" className="custom-class" />);

    const button = screen.getByTestId('custom-button');
    expect(button.className).toContain('custom-class');
  });
});
