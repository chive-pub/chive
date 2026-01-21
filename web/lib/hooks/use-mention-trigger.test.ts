/**
 * Tests for use-mention-trigger hook.
 *
 * @packageDocumentation
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMentionTrigger } from './use-mention-trigger';
import type { RefObject } from 'react';

// =============================================================================
// MOCKS
// =============================================================================

// Mock window.getSelection
const mockRange = {
  startContainer: document.createTextNode(''),
  startOffset: 0,
  collapsed: true,
  cloneRange: vi.fn(() => mockRange),
  getBoundingClientRect: vi.fn(() => ({
    top: 100,
    left: 200,
    width: 0,
    height: 0,
    bottom: 100,
    right: 200,
  })),
  insertNode: vi.fn(),
  deleteContents: vi.fn(),
  setStart: vi.fn(),
  setStartAfter: vi.fn(),
  collapse: vi.fn(),
};

const mockSelection = {
  rangeCount: 1,
  getRangeAt: vi.fn(() => mockRange),
  removeAllRanges: vi.fn(),
  addRange: vi.fn(),
};

// =============================================================================
// HELPERS
// =============================================================================

function createEditableRef(): RefObject<HTMLDivElement> {
  const element = document.createElement('div');
  element.contentEditable = 'true';
  document.body.appendChild(element);
  return { current: element };
}

function setTextAndCursor(element: HTMLElement, text: string, cursorOffset: number) {
  element.textContent = text;
  // Ensure we always have a text node
  let textNode: Text;
  if (element.firstChild && element.firstChild.nodeType === Node.TEXT_NODE) {
    textNode = element.firstChild as Text;
  } else {
    textNode = document.createTextNode(text);
    element.innerHTML = '';
    element.appendChild(textNode);
  }

  mockRange.startContainer = textNode;
  mockRange.startOffset = cursorOffset;
}

// =============================================================================
// TESTS
// =============================================================================

describe('useMentionTrigger', () => {
  let editableRef: RefObject<HTMLDivElement>;

  beforeEach(() => {
    editableRef = createEditableRef();
    vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as unknown as Selection);
    mockSelection.getRangeAt.mockReturnValue(mockRange);
    mockRange.cloneRange.mockReturnValue({ ...mockRange });
  });

  afterEach(() => {
    if (editableRef.current) {
      document.body.removeChild(editableRef.current);
    }
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('starts with closed state', () => {
      const { result } = renderHook(() => useMentionTrigger(editableRef));

      expect(result.current.state.isOpen).toBe(false);
      expect(result.current.state.trigger).toBeNull();
      expect(result.current.state.query).toBe('');
    });
  });

  describe('trigger detection', () => {
    it('detects @ trigger at start of text', () => {
      const { result } = renderHook(() => useMentionTrigger(editableRef));

      setTextAndCursor(editableRef.current!, '@MIT', 4);

      act(() => {
        result.current.handleInput();
      });

      expect(result.current.state.isOpen).toBe(true);
      expect(result.current.state.trigger).toBe('@');
      expect(result.current.state.query).toBe('MIT');
    });

    it('detects # trigger at start of text', () => {
      const { result } = renderHook(() => useMentionTrigger(editableRef));

      setTextAndCursor(editableRef.current!, '#field', 6);

      act(() => {
        result.current.handleInput();
      });

      expect(result.current.state.isOpen).toBe(true);
      expect(result.current.state.trigger).toBe('#');
      expect(result.current.state.query).toBe('field');
    });

    it('detects trigger after space', () => {
      const { result } = renderHook(() => useMentionTrigger(editableRef));

      setTextAndCursor(editableRef.current!, 'About @MIT', 10);

      act(() => {
        result.current.handleInput();
      });

      expect(result.current.state.isOpen).toBe(true);
      expect(result.current.state.trigger).toBe('@');
      expect(result.current.state.query).toBe('MIT');
    });

    it('does not detect trigger in middle of word', () => {
      const { result } = renderHook(() => useMentionTrigger(editableRef));

      setTextAndCursor(editableRef.current!, 'email@example.com', 16);

      act(() => {
        result.current.handleInput();
      });

      // Should not trigger because @ is not at word boundary
      expect(result.current.state.isOpen).toBe(false);
    });

    it('closes when query contains whitespace', () => {
      const { result } = renderHook(() => useMentionTrigger(editableRef));

      // First trigger
      setTextAndCursor(editableRef.current!, '@MIT', 4);
      act(() => {
        result.current.handleInput();
      });
      expect(result.current.state.isOpen).toBe(true);

      // Add space - should close
      setTextAndCursor(editableRef.current!, '@MIT is', 7);
      act(() => {
        result.current.handleInput();
      });
      expect(result.current.state.isOpen).toBe(false);
    });
  });

  describe('enabled triggers option', () => {
    it('only detects enabled triggers', () => {
      const { result } = renderHook(() =>
        useMentionTrigger(editableRef, { enabledTriggers: ['#'] })
      );

      // @ should not trigger
      setTextAndCursor(editableRef.current!, '@MIT', 4);
      act(() => {
        result.current.handleInput();
      });
      expect(result.current.state.isOpen).toBe(false);

      // # should trigger
      setTextAndCursor(editableRef.current!, '#field', 6);
      act(() => {
        result.current.handleInput();
      });
      expect(result.current.state.isOpen).toBe(true);
    });
  });

  describe('minQueryLength option', () => {
    it('respects minimum query length', () => {
      const { result } = renderHook(() => useMentionTrigger(editableRef, { minQueryLength: 2 }));

      // Single char - should not open
      setTextAndCursor(editableRef.current!, '@M', 2);
      act(() => {
        result.current.handleInput();
      });
      expect(result.current.state.isOpen).toBe(false);

      // Two chars - should open
      setTextAndCursor(editableRef.current!, '@MI', 3);
      act(() => {
        result.current.handleInput();
      });
      expect(result.current.state.isOpen).toBe(true);
    });
  });

  describe('close', () => {
    it('closes the autocomplete', () => {
      const { result } = renderHook(() => useMentionTrigger(editableRef));

      // Open
      setTextAndCursor(editableRef.current!, '@MIT', 4);
      act(() => {
        result.current.handleInput();
      });
      expect(result.current.state.isOpen).toBe(true);

      // Close
      act(() => {
        result.current.close();
      });
      expect(result.current.state.isOpen).toBe(false);
    });

    it('calls onClose callback', () => {
      const onClose = vi.fn();
      const { result } = renderHook(() => useMentionTrigger(editableRef, { onClose }));

      // Open
      setTextAndCursor(editableRef.current!, '@MIT', 4);
      act(() => {
        result.current.handleInput();
      });

      // Close
      act(() => {
        result.current.close();
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('handleKeyDown', () => {
    it('returns false when not open', () => {
      const { result } = renderHook(() => useMentionTrigger(editableRef));

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      const handled = result.current.handleKeyDown(event);
      expect(handled).toBe(false);
    });

    it('returns true for Escape when open', () => {
      const { result } = renderHook(() => useMentionTrigger(editableRef));

      // Open
      setTextAndCursor(editableRef.current!, '@MIT', 4);
      act(() => {
        result.current.handleInput();
      });

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      let handled: boolean = false;
      act(() => {
        handled = result.current.handleKeyDown(event);
      });
      expect(handled).toBe(true);
      expect(result.current.state.isOpen).toBe(false);
    });

    it('returns true for ArrowDown when open', () => {
      const { result } = renderHook(() => useMentionTrigger(editableRef));

      // Open
      setTextAndCursor(editableRef.current!, '@MIT', 4);
      act(() => {
        result.current.handleInput();
      });

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      const handled = result.current.handleKeyDown(event);
      expect(handled).toBe(true);
    });

    it('returns true for Enter when open', () => {
      const { result } = renderHook(() => useMentionTrigger(editableRef));

      // Open
      setTextAndCursor(editableRef.current!, '@MIT', 4);
      act(() => {
        result.current.handleInput();
      });

      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      const handled = result.current.handleKeyDown(event);
      expect(handled).toBe(true);
    });
  });

  describe('reset', () => {
    it('resets state completely', () => {
      const { result } = renderHook(() => useMentionTrigger(editableRef));

      // Open
      setTextAndCursor(editableRef.current!, '@MIT', 4);
      act(() => {
        result.current.handleInput();
      });
      expect(result.current.state.isOpen).toBe(true);

      // Reset
      act(() => {
        result.current.reset();
      });
      expect(result.current.state.isOpen).toBe(false);
      expect(result.current.state.trigger).toBeNull();
      expect(result.current.state.query).toBe('');
    });
  });

  describe('callbacks', () => {
    it('calls onOpen when autocomplete opens', () => {
      const onOpen = vi.fn();
      const { result } = renderHook(() => useMentionTrigger(editableRef, { onOpen }));

      setTextAndCursor(editableRef.current!, '@MIT', 4);
      act(() => {
        result.current.handleInput();
      });

      expect(onOpen).toHaveBeenCalled();
    });

    it('does not call onOpen when already open', () => {
      const onOpen = vi.fn();
      const { result } = renderHook(() => useMentionTrigger(editableRef, { onOpen }));

      // First open
      setTextAndCursor(editableRef.current!, '@M', 2);
      act(() => {
        result.current.handleInput();
      });

      // Query change but still open
      setTextAndCursor(editableRef.current!, '@MI', 3);
      act(() => {
        result.current.handleInput();
      });

      // onOpen should only be called once
      expect(onOpen).toHaveBeenCalledTimes(1);
    });
  });

  describe('position tracking', () => {
    it('provides cursor position when open', () => {
      const { result } = renderHook(() => useMentionTrigger(editableRef));

      setTextAndCursor(editableRef.current!, '@MIT', 4);
      act(() => {
        result.current.handleInput();
      });

      expect(result.current.state.position).not.toBeNull();
    });
  });
});
