/**
 * Tests for the follow control.
 *
 * @remarks
 * Following creates a collection in the reader's own repository, so the two
 * things worth holding the control to are that it says so before it writes
 * anything, and that the activity choice a reader makes is the choice that
 * gets written.
 *
 * @packageDocumentation
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { SubscribeButton } from '@/components/subscription/subscribe-button';

const subscribe = vi.fn((_types?: readonly string[]) => Promise.resolve());
const unsubscribe = vi.fn(() => Promise.resolve());
const setActivityTypes = vi.fn(() => Promise.resolve());

let state: Record<string, unknown> = {};

vi.mock('@/components/subscription/use-author-subscription', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/components/subscription/use-author-subscription')>();
  return {
    ...actual,
    useAuthorSubscription: () => ({
      subscribed: false,
      activityTypes: actual.DEFAULT_ACTIVITY_TYPES,
      isLoading: false,
      isPending: false,
      subscribe,
      unsubscribe,
      setActivityTypes,
      ...state,
    }),
  };
});

vi.mock('@/lib/auth', () => ({
  useIsAuthenticated: () => true,
}));

const AUTHOR = { authorDid: 'did:plc:a', authorName: 'Ada Lovelace' };

describe('SubscribeButton', () => {
  beforeEach(() => {
    state = {};
    subscribe.mockClear();
    unsubscribe.mockClear();
    setActivityTypes.mockClear();
  });

  it('offers to follow an author who is not yet followed', () => {
    render(<SubscribeButton {...AUTHOR} />);
    expect(screen.getByRole('button', { name: /follow/i })).toBeInTheDocument();
  });

  it('says that following creates a collection before anything is written', async () => {
    const user = userEvent.setup();
    render(<SubscribeButton {...AUTHOR} />);

    await user.click(screen.getByRole('button', { name: /follow/i }));

    // The mechanism is the feature, not an implementation detail: a reader is
    // told a collection appears in their library before they agree to it.
    expect(await screen.findByText(/creates a collection in your library/i)).toBeInTheDocument();
  });

  it('writes only the activity the reader chose', async () => {
    const user = userEvent.setup();
    render(<SubscribeButton {...AUTHOR} />);

    await user.click(screen.getByRole('button', { name: /follow/i }));
    // Turn one of the defaults off, and one non-default on.
    await user.click(await screen.findByRole('checkbox', { name: 'Reviews' }));
    await user.click(screen.getByRole('checkbox', { name: 'Citations' }));
    await user.click(screen.getByRole('button', { name: /follow ada lovelace/i }));

    await waitFor(() => {
      expect(subscribe).toHaveBeenCalledTimes(1);
    });
    const chosen = (subscribe.mock.calls[0]?.[0] ?? []) as readonly string[];
    // Groups expand to the event types they cover on the way out.
    expect(chosen).toContain('eprint_by_author');
    expect(chosen).toContain('eprint_referencing_person');
    expect(chosen).not.toContain('review_on_authored_eprint');
    expect(chosen).not.toContain('review_by_author');
  });

  it('will not follow with nothing selected', async () => {
    const user = userEvent.setup();
    render(<SubscribeButton {...AUTHOR} />);

    await user.click(screen.getByRole('button', { name: /follow/i }));
    for (const name of ['Papers', 'Reviews', 'Endorsements']) {
      await user.click(await screen.findByRole('checkbox', { name }));
    }

    expect(screen.getByRole('button', { name: /choose at least one/i })).toBeDisabled();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('reports an existing subscription and links to its collection', async () => {
    const user = userEvent.setup();
    state = {
      subscribed: true,
      collection: { uri: 'at://did:plc:a/pub.chive.graph.node/xyz', label: 'Following Ada' },
      activityTypes: ['eprint_by_author'],
    };
    render(<SubscribeButton {...AUTHOR} />);

    await user.click(screen.getByRole('button', { name: /following/i }));
    expect(await screen.findByRole('link', { name: /open collection/i })).toBeInTheDocument();
  });

  it('commits a changed activity choice when the editor closes', async () => {
    const user = userEvent.setup();
    state = { subscribed: true, activityTypes: ['eprint_by_author'] };
    render(<SubscribeButton {...AUTHOR} />);

    await user.click(screen.getByRole('button', { name: /following/i }));
    await user.click(await screen.findByRole('checkbox', { name: 'Citations' }));
    // A separate Save is a step that exists only to be forgotten.
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(setActivityTypes).toHaveBeenCalledWith([
        'eprint_by_author',
        'eprint_referencing_person',
      ]);
    });
  });

  it('does not rewrite the choice when nothing changed', async () => {
    const user = userEvent.setup();
    state = { subscribed: true, activityTypes: ['eprint_by_author'] };
    render(<SubscribeButton {...AUTHOR} />);

    await user.click(screen.getByRole('button', { name: /following/i }));
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(setActivityTypes).not.toHaveBeenCalled();
    });
  });

  it('unfollows', async () => {
    const user = userEvent.setup();
    state = { subscribed: true, activityTypes: ['eprint_by_author'] };
    render(<SubscribeButton {...AUTHOR} />);

    await user.click(screen.getByRole('button', { name: /following/i }));
    await user.click(await screen.findByRole('button', { name: /unfollow/i }));

    await waitFor(() => {
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});
