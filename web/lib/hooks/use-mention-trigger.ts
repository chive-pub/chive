/**
 * Hook for detecting @ and # triggers in contenteditable elements.
 *
 * @remarks
 * Provides trigger detection for mention autocomplete:
 * - `@` trigger for object nodes (institutions, persons, etc.)
 * - `#` trigger for type nodes (fields, facets, etc.)
 *
 * Works with contenteditable div elements (not textarea).
 *
 * @example
 * ```tsx
 * const editableRef = useRef<HTMLDivElement>(null);
 * const { state, handleInput, handleKeyDown, insertChip, close } =
 *   useMentionTrigger(editableRef);
 *
 * return (
 *   <div
 *     ref={editableRef}
 *     contentEditable
 *     onInput={handleInput}
 *     onKeyDown={(e) => handleKeyDown(e.nativeEvent)}
 *   />
 * );
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback, useRef, type RefObject } from 'react';
import type { NodeResult } from '@/components/knowledge-graph/node-search';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Trigger type.
 */
export type MentionTriggerType = '@' | '#';

/**
 * State for mention trigger detection.
 */
export interface MentionTriggerState {
  /** Active trigger character (@ or #) */
  trigger: MentionTriggerType | null;
  /** Text typed after the trigger */
  query: string;
  /** Saved selection range for chip insertion */
  range: Range | null;
  /** Cursor position for autocomplete positioning */
  position: { top: number; left: number } | null;
  /** Whether autocomplete is open */
  isOpen: boolean;
}

/**
 * Options for the mention trigger hook.
 */
export interface UseMentionTriggerOptions {
  /** Minimum query length before showing autocomplete */
  minQueryLength?: number;
  /** Which triggers are enabled */
  enabledTriggers?: MentionTriggerType[];
  /** Callback when autocomplete opens */
  onOpen?: () => void;
  /** Callback when autocomplete closes */
  onClose?: () => void;
}

/**
 * Return type for the mention trigger hook.
 */
export interface UseMentionTriggerReturn {
  /** Current trigger state */
  state: MentionTriggerState;
  /** Handler for input events */
  handleInput: () => void;
  /** Handler for keydown events, returns true if handled */
  handleKeyDown: (e: KeyboardEvent) => boolean;
  /** Insert a chip at the saved range */
  insertChip: (node: NodeResult, trigger: MentionTriggerType) => void;
  /** Close the autocomplete */
  close: () => void;
  /** Reset state completely */
  reset: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TRIGGER_CHARS = ['@', '#'] as const;

const INITIAL_STATE: MentionTriggerState = {
  trigger: null,
  query: '',
  range: null,
  position: null,
  isOpen: false,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the current cursor position relative to the viewport.
 */
function getCursorPosition(): { top: number; left: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // If the rect has no dimensions (collapsed selection), use caret position
  if (rect.width === 0 && rect.height === 0) {
    // Create a temporary element to get position
    const tempSpan = document.createElement('span');
    tempSpan.textContent = '\u200B'; // Zero-width space
    range.insertNode(tempSpan);
    const tempRect = tempSpan.getBoundingClientRect();
    tempSpan.remove();

    // Normalize the range after modification
    range.collapse(true);

    return {
      top: tempRect.bottom,
      left: tempRect.left,
    };
  }

  return {
    top: rect.bottom,
    left: rect.left,
  };
}

/**
 * Get the text before the cursor in the current text node.
 */
function getTextBeforeCursor(element: HTMLElement): { text: string; node: Node | null } {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return { text: '', node: null };
  }

  const range = selection.getRangeAt(0);
  const node = range.startContainer;

  // Only process text nodes
  if (node.nodeType !== Node.TEXT_NODE) {
    return { text: '', node: null };
  }

  const text = node.textContent?.slice(0, range.startOffset) ?? '';
  return { text, node };
}

/**
 * Find the trigger and query in text before cursor.
 */
function findTrigger(
  text: string,
  enabledTriggers: MentionTriggerType[]
): { trigger: MentionTriggerType; query: string; triggerIndex: number } | null {
  // Look for the last trigger character
  let lastTriggerIndex = -1;
  let lastTrigger: MentionTriggerType | null = null;

  for (const trigger of enabledTriggers) {
    const idx = text.lastIndexOf(trigger);
    if (idx > lastTriggerIndex) {
      lastTriggerIndex = idx;
      lastTrigger = trigger;
    }
  }

  if (lastTrigger === null || lastTriggerIndex === -1) {
    return null;
  }

  // Check if trigger is at word boundary (start of text or after whitespace/punctuation)
  const charBefore = text[lastTriggerIndex - 1];
  if (charBefore && !/[\s\n\r.,;:!?()[\]{}]/.test(charBefore)) {
    return null;
  }

  // Get query after trigger
  const query = text.slice(lastTriggerIndex + 1);

  // Query should not contain whitespace (indicates user moved on)
  if (/\s/.test(query)) {
    return null;
  }

  return {
    trigger: lastTrigger,
    query,
    triggerIndex: lastTriggerIndex,
  };
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for detecting mention triggers in contenteditable elements.
 *
 * @param editableRef - Ref to the contenteditable element
 * @param options - Configuration options
 * @returns Trigger state and handlers
 */
export function useMentionTrigger(
  editableRef: RefObject<HTMLElement | null>,
  options: UseMentionTriggerOptions = {}
): UseMentionTriggerReturn {
  const { minQueryLength = 0, enabledTriggers = ['@', '#'], onOpen, onClose } = options;

  const [state, setState] = useState<MentionTriggerState>(INITIAL_STATE);
  const savedRangeRef = useRef<Range | null>(null);

  /**
   * Handle input events - detect triggers.
   */
  const handleInput = useCallback(() => {
    if (!editableRef.current) {
      return;
    }

    const { text } = getTextBeforeCursor(editableRef.current);
    const triggerResult = findTrigger(text, enabledTriggers);

    if (triggerResult && triggerResult.query.length >= minQueryLength) {
      // Save the current range for later chip insertion
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        savedRangeRef.current = selection.getRangeAt(0).cloneRange();
      }

      const position = getCursorPosition();

      const wasOpen = state.isOpen;
      setState({
        trigger: triggerResult.trigger,
        query: triggerResult.query,
        range: savedRangeRef.current,
        position,
        isOpen: true,
      });

      if (!wasOpen && onOpen) {
        onOpen();
      }
    } else if (state.isOpen) {
      // Close autocomplete
      setState(INITIAL_STATE);
      savedRangeRef.current = null;
      if (onClose) {
        onClose();
      }
    }
  }, [editableRef, enabledTriggers, minQueryLength, state.isOpen, onOpen, onClose]);

  /**
   * Handle keydown events.
   * Returns true if the event was handled (should preventDefault).
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent): boolean => {
      if (!state.isOpen) {
        return false;
      }

      // Escape closes autocomplete
      if (e.key === 'Escape') {
        setState(INITIAL_STATE);
        savedRangeRef.current = null;
        if (onClose) {
          onClose();
        }
        return true;
      }

      // These keys are handled by the autocomplete component
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Tab') {
        return true;
      }

      return false;
    },
    [state.isOpen, onClose]
  );

  /**
   * Insert a chip at the saved range, replacing trigger and query.
   */
  const insertChip = useCallback(
    (node: NodeResult, trigger: MentionTriggerType) => {
      if (!editableRef.current || !savedRangeRef.current) {
        return;
      }

      const selection = window.getSelection();
      if (!selection) {
        return;
      }

      // Restore the saved range
      selection.removeAllRanges();
      selection.addRange(savedRangeRef.current);

      const range = selection.getRangeAt(0);
      const textNode = range.startContainer;

      if (textNode.nodeType !== Node.TEXT_NODE) {
        return;
      }

      const text = textNode.textContent ?? '';
      const cursorPos = range.startOffset;

      // Find where the trigger started
      const textBefore = text.slice(0, cursorPos);
      const triggerIndex = textBefore.lastIndexOf(trigger);

      if (triggerIndex === -1) {
        return;
      }

      // Create the chip element
      const chip = document.createElement('span');
      chip.contentEditable = 'false';
      chip.dataset.nodeUri = node.uri;
      chip.dataset.nodeLabel = node.label;
      chip.dataset.kind = node.kind;
      chip.dataset.subkind = node.subkind;
      chip.className = 'mention-chip';
      chip.setAttribute('data-trigger', trigger);

      // Create visible badge inside chip
      const badge = document.createElement('span');
      badge.className = 'inline-flex items-center rounded px-1.5 py-0.5 text-sm font-medium mx-0.5';
      badge.textContent = node.label;
      chip.appendChild(badge);

      // Split the text node and insert chip
      const beforeText = text.slice(0, triggerIndex);
      const afterText = text.slice(cursorPos);

      // Create new text nodes
      const beforeNode = document.createTextNode(beforeText);
      const afterNode = document.createTextNode(afterText || '\u00A0'); // Non-breaking space if empty

      // Replace the original text node with our new structure
      const parent = textNode.parentNode;
      if (!parent) {
        return;
      }

      parent.insertBefore(beforeNode, textNode);
      parent.insertBefore(chip, textNode);
      parent.insertBefore(afterNode, textNode);
      parent.removeChild(textNode);

      // Move cursor to after the chip
      const newRange = document.createRange();
      newRange.setStart(afterNode, 0);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);

      // Reset state
      setState(INITIAL_STATE);
      savedRangeRef.current = null;
      if (onClose) {
        onClose();
      }

      // Dispatch input event to trigger any listeners
      editableRef.current.dispatchEvent(new Event('input', { bubbles: true }));
    },
    [editableRef, onClose]
  );

  /**
   * Close the autocomplete without inserting.
   */
  const close = useCallback(() => {
    setState(INITIAL_STATE);
    savedRangeRef.current = null;
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  /**
   * Reset state completely.
   */
  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    savedRangeRef.current = null;
  }, []);

  return {
    state,
    handleInput,
    handleKeyDown,
    insertChip,
    close,
    reset,
  };
}
