/**
 * Tests for FaroInit component.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import { FaroInit } from './faro-init';

// Mock the Faro initialization functions
vi.mock('@/lib/observability/faro', () => ({
  initializeFaro: vi.fn(() => ({ api: {} })),
  initWebVitals: vi.fn(() => () => {}),
}));

describe('FaroInit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing (returns null)', () => {
    const { container } = render(<FaroInit />);
    expect(container.firstChild).toBeNull();
  });

  it('initializes Faro on mount', async () => {
    const { initializeFaro } = await import('@/lib/observability/faro');

    render(<FaroInit />);

    await waitFor(() => {
      expect(initializeFaro).toHaveBeenCalledTimes(1);
    });
  });

  it('initializes Web Vitals when Faro is available', async () => {
    const { initializeFaro, initWebVitals } = await import('@/lib/observability/faro');
    vi.mocked(initializeFaro).mockReturnValue({ api: {} } as ReturnType<typeof initializeFaro>);

    render(<FaroInit />);

    await waitFor(() => {
      expect(initWebVitals).toHaveBeenCalledTimes(1);
    });
  });

  it('does not initialize when disabled', async () => {
    const { initializeFaro } = await import('@/lib/observability/faro');

    render(<FaroInit disabled />);

    // Wait a tick to ensure effect would have run
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(initializeFaro).not.toHaveBeenCalled();
  });

  it('does not initialize Web Vitals when disableWebVitals is true', async () => {
    const { initializeFaro, initWebVitals } = await import('@/lib/observability/faro');
    vi.mocked(initializeFaro).mockReturnValue({ api: {} } as ReturnType<typeof initializeFaro>);

    render(<FaroInit disableWebVitals />);

    await waitFor(() => {
      expect(initializeFaro).toHaveBeenCalled();
    });

    expect(initWebVitals).not.toHaveBeenCalled();
  });

  it('does not initialize Web Vitals when Faro returns null', async () => {
    const { initializeFaro, initWebVitals } = await import('@/lib/observability/faro');
    vi.mocked(initializeFaro).mockReturnValue(null);

    render(<FaroInit />);

    await waitFor(() => {
      expect(initializeFaro).toHaveBeenCalled();
    });

    expect(initWebVitals).not.toHaveBeenCalled();
  });

  it('only initializes once even with re-renders', async () => {
    const { initializeFaro } = await import('@/lib/observability/faro');

    const { rerender } = render(<FaroInit />);

    await waitFor(() => {
      expect(initializeFaro).toHaveBeenCalledTimes(1);
    });

    // Re-render multiple times
    rerender(<FaroInit />);
    rerender(<FaroInit />);
    rerender(<FaroInit />);

    // Should still only be called once
    expect(initializeFaro).toHaveBeenCalledTimes(1);
  });
});
