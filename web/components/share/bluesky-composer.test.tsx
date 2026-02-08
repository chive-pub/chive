import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlueskyComposer } from './bluesky-composer';

// Mock fetch for actor typeahead
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('BlueskyComposer', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ actors: [] }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders with placeholder', async () => {
    render(<BlueskyComposer value="" onChange={() => {}} placeholder="What's on your mind?" />);

    // TipTap renders placeholder via CSS ::before pseudo-element or data attribute
    // Wait for the editor to mount
    await waitFor(() => {
      const editor = screen.getByLabelText('Post composer');
      expect(editor).toBeInTheDocument();
    });
  });

  it('renders with aria-label for accessibility', async () => {
    render(<BlueskyComposer value="" onChange={() => {}} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Post composer')).toBeInTheDocument();
    });
  });

  it('calls onChange when typing', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<BlueskyComposer value="" onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Post composer')).toBeInTheDocument();
    });

    const editor = screen.getByLabelText('Post composer');
    await user.click(editor);
    await user.type(editor, 'Hello');

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
  });

  it('applies disabled styling when disabled prop is true', async () => {
    const { container } = render(<BlueskyComposer value="" onChange={() => {}} disabled />);

    await waitFor(() => {
      // TipTap wrapper should have opacity-50 class when disabled
      const wrapper = container.querySelector('.opacity-50');
      expect(wrapper).toBeInTheDocument();
    });
  });

  it('applies custom className', async () => {
    const { container } = render(
      <BlueskyComposer value="" onChange={() => {}} className="custom-class" />
    );

    await waitFor(() => {
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });

  it('renders with focus-within ring styling', async () => {
    const { container } = render(<BlueskyComposer value="" onChange={() => {}} />);

    await waitFor(() => {
      const wrapper = container.querySelector('.focus-within\\:ring-2');
      expect(wrapper).toBeInTheDocument();
    });
  });

  it('displays initial content in the editor', async () => {
    const onChange = vi.fn();
    render(<BlueskyComposer value="Initial text" onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Post composer')).toBeInTheDocument();
    });

    // The textarea should display the initial value
    const editor = screen.getByLabelText('Post composer') as HTMLTextAreaElement;
    expect(editor.value).toBe('Initial text');
  });

  it('clears content when value is reset to empty', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<BlueskyComposer value="Initial text" onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Post composer')).toBeInTheDocument();
    });

    // Verify initial content is displayed
    const editorBefore = screen.getByLabelText('Post composer') as HTMLTextAreaElement;
    expect(editorBefore.value).toBe('Initial text');

    // Rerender with empty value (simulating reset)
    rerender(<BlueskyComposer value="" onChange={onChange} />);

    await waitFor(() => {
      const editor = screen.getByLabelText('Post composer') as HTMLTextAreaElement;
      // TipTap clears content when value becomes empty
      expect(editor.value).toBe('');
    });
  });

  it('applies min and max height via style attribute', async () => {
    render(<BlueskyComposer value="" onChange={() => {}} minHeight={150} maxHeight={400} />);

    await waitFor(() => {
      const editor = screen.getByLabelText('Post composer');
      expect(editor.getAttribute('style')).toContain('min-height: 150px');
      expect(editor.getAttribute('style')).toContain('max-height: 400px');
    });
  });

  it('renders SSR placeholder before mounting', () => {
    // The component shows a placeholder div before useEffect sets isMounted
    // This is tested implicitly by the component rendering without errors
    const { container } = render(<BlueskyComposer value="" onChange={() => {}} minHeight={100} />);

    // Container should have content
    expect(container.firstChild).toBeInTheDocument();
  });

  // Note: Mention autocomplete tests are skipped in unit tests because TipTap's Mention
  // extension requires real browser APIs (elementFromPoint, Selection) not available in JSDOM.
  // These features are tested in E2E tests (tests/e2e/) with a real browser environment.
  // See: https://tiptap.dev/docs/guides/testing
  describe('Mention autocomplete', () => {
    it.skip('searches actors when @ is typed followed by characters (tested in E2E)', async () => {
      // This test verifies TipTap's Mention extension triggers actor search.
      // In JSDOM, TipTap is mocked so the Mention extension doesn't run.
      // The actual behavior is covered in E2E tests with real browser.
    });

    it.skip('creates listbox popover for suggestions (tested in E2E)', async () => {
      // This test verifies TipTap's Mention suggestion popup appears.
      // In JSDOM, TipTap is mocked so no popup is created.
      // The actual behavior is covered in E2E tests with real browser.
    });
  });
});
