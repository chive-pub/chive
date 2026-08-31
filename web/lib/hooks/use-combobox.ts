'use client';

/**
 * The WAI-ARIA combobox pattern, as a hook.
 *
 * @remarks
 * Chive has around twenty autocompletes. Ten of them delegate to
 * `AutocompleteInput` and get this behaviour from there; the rest render their
 * own input and their own grouped list, because they show sections that the
 * shared component does not model — Chive events beside DBLP results, personal
 * nodes beside global ones.
 *
 * Rewriting those onto the shared component would mean teaching it every
 * grouping any caller might want. This hook takes the other half of the
 * problem instead: it owns the keyboard and the ARIA wiring, and leaves the
 * markup alone. A component supplies its options in the order it renders them
 * and spreads the props it is handed.
 *
 * What every adopter gets, and what most of them had none of before: arrow
 * keys, Home and End, Enter to commit, Escape to dismiss, and an
 * `aria-activedescendant` that tells a screen reader which suggestion is
 * current. Several of these components handled Escape and nothing else, so a
 * keyboard user could open a list of suggestions and had no way to reach one.
 *
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/combobox/}
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useId, useState } from 'react';

/**
 * What {@link useCombobox} needs to know.
 *
 * @public
 */
export interface UseComboboxOptions<T> {
  /** The options as rendered, in render order. Grouped lists flatten here. */
  options: readonly T[];
  /** Whether the list is showing */
  isOpen: boolean;
  /** Called when the user commits the highlighted option */
  onSelect: (option: T) => void;
  /** Called when the user dismisses the list */
  onClose: () => void;
  /** Called when a closed list should open, on ArrowDown */
  onOpen?: () => void;
  /** Stable id, when the caller has one; otherwise generated */
  id?: string;
}

/**
 * What {@link useCombobox} gives back.
 *
 * @public
 */
export interface UseComboboxResult {
  /** Index of the highlighted option, or -1 */
  activeIndex: number;
  /** Set the highlight directly, for pointer hover */
  setActiveIndex: (index: number) => void;
  /** Spread onto the text input */
  inputProps: {
    role: 'combobox';
    'aria-expanded': boolean;
    'aria-controls': string;
    'aria-autocomplete': 'list';
    'aria-activedescendant': string | undefined;
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  };
  /** Spread onto the element wrapping the options */
  listboxProps: { id: string; role: 'listbox' };
  /** Spread onto option number `index` */
  getOptionProps: (index: number) => {
    id: string;
    role: 'option';
    'aria-selected': boolean;
    onMouseEnter: () => void;
  };
}

/**
 * Wire up the combobox pattern for a component that renders its own list.
 *
 * @param options - See {@link UseComboboxOptions}
 * @returns Props to spread and the current highlight
 *
 * @example
 * ```tsx
 * const combobox = useCombobox({
 *   options: visibleResults,
 *   isOpen: showResults,
 *   onSelect: handleSelect,
 *   onClose: () => setShowResults(false),
 * });
 *
 * <Input {...combobox.inputProps} value={query} onChange={onChange} />
 * <ul {...combobox.listboxProps}>
 *   {visibleResults.map((r, i) => (
 *     <li key={r.id} {...combobox.getOptionProps(i)}>{r.label}</li>
 *   ))}
 * </ul>
 * ```
 *
 * @public
 */
export function useCombobox<T>({
  options,
  isOpen,
  onSelect,
  onClose,
  onOpen,
  id,
}: UseComboboxOptions<T>): UseComboboxResult {
  const [activeIndex, setActiveIndex] = useState(-1);

  const generatedId = useId();
  const listboxId = `${id ?? generatedId}-listbox`;
  const optionId = useCallback((index: number) => `${listboxId}-option-${index}`, [listboxId]);

  // A new result set invalidates the highlight: index 2 of the old list is not
  // index 2 of the new one, and committing it would select something the user
  // never saw highlighted.
  useEffect(() => {
    setActiveIndex(-1);
  }, [options]);

  // Closing clears the highlight, so reopening does not restore a stale one.
  useEffect(() => {
    if (!isOpen) {
      setActiveIndex(-1);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (!isOpen || options.length === 0) {
        // Down opens a closed list rather than doing nothing.
        if (event.key === 'ArrowDown' && onOpen) {
          event.preventDefault();
          onOpen();
        }
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setActiveIndex((i) => (i + 1) % options.length);
          break;
        case 'ArrowUp':
          event.preventDefault();
          setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
          break;
        case 'Home':
          event.preventDefault();
          setActiveIndex(0);
          break;
        case 'End':
          event.preventDefault();
          setActiveIndex(options.length - 1);
          break;
        case 'Enter': {
          const option = options[activeIndex];
          if (option !== undefined) {
            // Only when something is highlighted. A user typing free text and
            // pressing Enter means to submit the form, not to accept a
            // suggestion they never moved to.
            event.preventDefault();
            onSelect(option);
          }
          break;
        }
        default:
          break;
      }
    },
    [isOpen, options, activeIndex, onSelect, onClose, onOpen]
  );

  return {
    activeIndex,
    setActiveIndex,
    inputProps: {
      role: 'combobox',
      'aria-expanded': isOpen,
      'aria-controls': listboxId,
      'aria-autocomplete': 'list',
      'aria-activedescendant': activeIndex >= 0 && isOpen ? optionId(activeIndex) : undefined,
      onKeyDown: handleKeyDown,
    },
    listboxProps: { id: listboxId, role: 'listbox' },
    getOptionProps: (index: number) => ({
      id: optionId(index),
      role: 'option',
      'aria-selected': index === activeIndex,
      onMouseEnter: () => setActiveIndex(index),
    }),
  };
}
