/**
 * Tests for clamping long prose.
 *
 * @remarks
 * jsdom reports every element as zero-height, so `scrollHeight > clientHeight`
 * is never true by accident. Each case that needs an overflowing element says
 * so explicitly, which also documents what the component measures.
 *
 * @packageDocumentation
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { ExpandableProse } from '@/components/ui/expandable-prose';

/**
 * Makes every element report itself as overflowing its clamp.
 */
function makeContentOverflow(scrollHeight: number, clientHeight: number) {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => scrollHeight,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => clientHeight,
  });
}

beforeEach(() => {
  // jsdom has no ResizeObserver.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error restoring the prototype descriptors jsdom shipped with
  delete HTMLElement.prototype.scrollHeight;
  // @ts-expect-error restoring the prototype descriptors jsdom shipped with
  delete HTMLElement.prototype.clientHeight;
});

describe('ExpandableProse', () => {
  it('always renders its content', () => {
    render(<ExpandableProse>A short bio.</ExpandableProse>);
    expect(screen.getByText('A short bio.')).toBeInTheDocument();
  });

  it('offers no control when the prose is not clipped', () => {
    // A "Show more" beside three lines that were never truncated is worse than
    // no control at all.
    makeContentOverflow(40, 40);
    render(<ExpandableProse>A short bio.</ExpandableProse>);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers a control when the prose is clipped', () => {
    makeContentOverflow(400, 80);
    render(<ExpandableProse>A very long bio.</ExpandableProse>);

    expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument();
  });

  it('reveals the rest when asked, and can be collapsed again', async () => {
    makeContentOverflow(400, 80);
    const user = userEvent.setup();
    render(<ExpandableProse>A very long bio.</ExpandableProse>);

    const button = screen.getByRole('button', { name: /show more/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);

    const collapse = screen.getByRole('button', { name: /show less/i });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');

    await user.click(collapse);
    expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument();
  });

  it('names the region it controls, so the control is announced usefully', () => {
    makeContentOverflow(400, 80);
    render(<ExpandableProse>A very long bio.</ExpandableProse>);

    const button = screen.getByRole('button', { name: /show more/i });
    const controlled = button.getAttribute('aria-controls');

    expect(controlled).toBeTruthy();
    expect(document.getElementById(controlled ?? '')).toHaveTextContent('A very long bio.');
  });

  it('drops the clamp once expanded', async () => {
    makeContentOverflow(400, 80);
    const user = userEvent.setup();
    render(<ExpandableProse lines={4}>A very long bio.</ExpandableProse>);

    const region = document.getElementById(
      screen.getByRole('button').getAttribute('aria-controls') ?? ''
    );
    expect(region?.className).toContain('line-clamp-4');

    await user.click(screen.getByRole('button'));
    expect(region?.className).not.toContain('line-clamp-4');
  });

  it('uses a literal clamp class, since Tailwind cannot see an interpolated one', () => {
    makeContentOverflow(400, 80);
    render(<ExpandableProse lines={6}>A very long bio.</ExpandableProse>);

    const region = document.getElementById(
      screen.getByRole('button').getAttribute('aria-controls') ?? ''
    );
    expect(region?.className).toContain('line-clamp-6');
  });
});
