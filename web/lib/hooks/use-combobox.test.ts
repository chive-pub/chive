/**
 * Tests for the combobox keyboard hook.
 *
 * @remarks
 * Half of Chive's autocompletes render their own grouped list rather than
 * delegating to `AutocompleteInput`, and most of them handled Escape and no
 * other key — a keyboard user could open a list of suggestions and had no way
 * to reach one. This hook is what those components adopt.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useCombobox } from './use-combobox';

const OPTIONS = ['alpha', 'beta', 'gamma'];

function key(k: string) {
  return { key: k, preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>;
}

function setup(overrides: Partial<Parameters<typeof useCombobox<string>>[0]> = {}) {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  const onOpen = vi.fn();
  const { result, rerender } = renderHook(
    (props: { options: string[]; isOpen: boolean }) =>
      useCombobox<string>({
        options: props.options,
        isOpen: props.isOpen,
        onSelect,
        onClose,
        onOpen,
        ...overrides,
      }),
    { initialProps: { options: OPTIONS, isOpen: true } }
  );
  return { result, rerender, onSelect, onClose, onOpen };
}

describe('useCombobox', () => {
  it('starts with nothing highlighted', () => {
    const { result } = setup();
    expect(result.current.activeIndex).toBe(-1);
  });

  it('reports the combobox role and list semantics', () => {
    const { result } = setup();
    expect(result.current.inputProps.role).toBe('combobox');
    expect(result.current.inputProps['aria-autocomplete']).toBe('list');
    expect(result.current.listboxProps.role).toBe('listbox');
  });

  it('points aria-controls at the listbox it renders', () => {
    const { result } = setup();
    expect(result.current.inputProps['aria-controls']).toBe(result.current.listboxProps.id);
  });

  it('moves down through the options', () => {
    const { result } = setup();
    act(() => result.current.inputProps.onKeyDown(key('ArrowDown')));
    expect(result.current.activeIndex).toBe(0);
    act(() => result.current.inputProps.onKeyDown(key('ArrowDown')));
    expect(result.current.activeIndex).toBe(1);
  });

  it('wraps past the end back to the first option', () => {
    const { result } = setup();
    for (let i = 0; i < OPTIONS.length; i++) {
      act(() => result.current.inputProps.onKeyDown(key('ArrowDown')));
    }
    act(() => result.current.inputProps.onKeyDown(key('ArrowDown')));
    expect(result.current.activeIndex).toBe(0);
  });

  it('wraps backwards from nothing to the last option', () => {
    const { result } = setup();
    act(() => result.current.inputProps.onKeyDown(key('ArrowUp')));
    expect(result.current.activeIndex).toBe(OPTIONS.length - 1);
  });

  it('jumps to the ends with Home and End', () => {
    const { result } = setup();
    act(() => result.current.inputProps.onKeyDown(key('End')));
    expect(result.current.activeIndex).toBe(2);
    act(() => result.current.inputProps.onKeyDown(key('Home')));
    expect(result.current.activeIndex).toBe(0);
  });

  it('commits the highlighted option with Enter', () => {
    const { result, onSelect } = setup();
    act(() => result.current.inputProps.onKeyDown(key('ArrowDown')));
    act(() => result.current.inputProps.onKeyDown(key('Enter')));
    expect(onSelect).toHaveBeenCalledWith('alpha');
  });

  it('leaves Enter alone when nothing is highlighted', () => {
    // A user typing free text and pressing Enter means to submit the form.
    const { result, onSelect } = setup();
    act(() => result.current.inputProps.onKeyDown(key('Enter')));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('closes on Escape without selecting', () => {
    const { result, onClose, onSelect } = setup();
    act(() => result.current.inputProps.onKeyDown(key('ArrowDown')));
    act(() => result.current.inputProps.onKeyDown(key('Escape')));
    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('opens a closed list with the down arrow', () => {
    const { result, rerender, onOpen } = setup();
    rerender({ options: OPTIONS, isOpen: false });
    act(() => result.current.inputProps.onKeyDown(key('ArrowDown')));
    expect(onOpen).toHaveBeenCalled();
  });

  it('announces the active option through aria-activedescendant', () => {
    const { result } = setup();
    expect(result.current.inputProps['aria-activedescendant']).toBeUndefined();
    act(() => result.current.inputProps.onKeyDown(key('ArrowDown')));
    expect(result.current.inputProps['aria-activedescendant']).toBe(
      result.current.getOptionProps(0).id
    );
  });

  it('marks exactly one option selected', () => {
    const { result } = setup();
    act(() => result.current.inputProps.onKeyDown(key('ArrowDown')));
    const selected = OPTIONS.map((_, i) => result.current.getOptionProps(i)['aria-selected']);
    expect(selected.filter(Boolean)).toHaveLength(1);
  });

  it('drops the highlight when the results change', () => {
    // Index 2 of the old list is not index 2 of the new one, and committing it
    // would select something the user never saw highlighted.
    const { result, rerender } = setup();
    act(() => result.current.inputProps.onKeyDown(key('ArrowDown')));
    expect(result.current.activeIndex).toBe(0);
    rerender({ options: ['delta', 'epsilon'], isOpen: true });
    expect(result.current.activeIndex).toBe(-1);
  });

  it('drops the highlight when the list closes', () => {
    const { result, rerender } = setup();
    act(() => result.current.inputProps.onKeyDown(key('ArrowDown')));
    rerender({ options: OPTIONS, isOpen: false });
    expect(result.current.activeIndex).toBe(-1);
  });

  it('does nothing on arrow keys with no options', () => {
    const { result, rerender, onSelect } = setup();
    rerender({ options: [], isOpen: true });
    act(() => result.current.inputProps.onKeyDown(key('ArrowDown')));
    act(() => result.current.inputProps.onKeyDown(key('Enter')));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
