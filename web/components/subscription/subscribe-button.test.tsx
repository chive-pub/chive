/**
 * Tests for the subscribe control.
 *
 * @remarks
 * The record is written into the reader's own repository, so the control has to
 * behave sensibly before it knows anything: while the status is loading, when
 * the author holds no publication, and when the write fails.
 *
 * @packageDocumentation
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { SubscribeButton } from '@/components/subscription/subscribe-button';

const toggle = vi.fn();
let state: Record<string, unknown> = {};

vi.mock('@/lib/hooks/use-subscription', () => ({
  useSubscription: () => ({
    subscribed: false,
    subscriberCount: 0,
    isLoading: false,
    isPending: false,
    toggle,
    ...state,
  }),
}));

vi.mock('@/lib/auth', () => ({
  useIsAuthenticated: () => true,
}));

describe('SubscribeButton', () => {
  beforeEach(() => {
    state = {};
    toggle.mockReset();
  });

  it('renders nothing when the author has no publication and no subscribers', () => {
    // Hidden rather than disabled: a disabled Subscribe invites a reader to
    // work out what they did wrong, when there is nothing on the other end.
    const { container } = render(<SubscribeButton authorDid="did:plc:a" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the count even when there is nothing to subscribe to', () => {
    // The count describes the author, not the reader's options.
    state = { subscriberCount: 4 };
    render(<SubscribeButton authorDid="did:plc:a" />);

    expect(screen.getByText('4 subscribers')).toBeInTheDocument();
  });

  it('offers to subscribe when the author has a publication', () => {
    state = { publicationUri: 'at://did:plc:a/site.standard.publication/1' };
    render(<SubscribeButton authorDid="did:plc:a" />);

    const button = screen.getByRole('button', { name: /subscribe/i });
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the subscribed state to assistive technology', () => {
    state = {
      publicationUri: 'at://did:plc:a/site.standard.publication/1',
      subscribed: true,
    };
    render(<SubscribeButton authorDid="did:plc:a" />);

    expect(screen.getByRole('button', { name: /subscribed/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('writes the subscription when pressed', async () => {
    state = { publicationUri: 'at://did:plc:a/site.standard.publication/1' };
    const user = userEvent.setup();
    render(<SubscribeButton authorDid="did:plc:a" />);

    await user.click(screen.getByRole('button', { name: /subscribe/i }));

    await waitFor(() => {
      expect(toggle).toHaveBeenCalledOnce();
    });
  });

  it('does not accept a second press while one is in flight', async () => {
    state = { publicationUri: 'at://did:plc:a/site.standard.publication/1', isPending: true };
    const user = userEvent.setup();
    render(<SubscribeButton authorDid="did:plc:a" />);

    await user.click(screen.getByRole('button', { name: /subscribe/i }));

    expect(toggle).not.toHaveBeenCalled();
  });

  it('surfaces a failed write rather than silently reverting', () => {
    state = {
      publicationUri: 'at://did:plc:a/site.standard.publication/1',
      error: 'Could not update the subscription',
    };
    render(<SubscribeButton authorDid="did:plc:a" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not update the subscription');
  });
});
