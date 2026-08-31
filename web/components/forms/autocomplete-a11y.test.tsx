/**
 * Tests for the combobox accessibility pattern.
 *
 * @remarks
 * Chive has around twenty autocompletes. Two implemented the WAI-ARIA combobox
 * pattern; the shared base implemented none of it, and `node-autocomplete` —
 * the single-select behind every knowledge-graph field — handled Escape and no
 * other key. A keyboard user could open a list of suggestions and had no way to
 * reach one, and a screen reader was told nothing about the list existing.
 *
 * These tests pin the contract on the two components the rest are meant to
 * consolidate onto.
 *
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/combobox/}
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/tests/test-utils';

import { AutocompleteInput } from './autocomplete-input';

interface Fruit {
  id: string;
  name: string;
}

const FRUITS: Fruit[] = [
  { id: 'a', name: 'Apple' },
  { id: 'b', name: 'Banana' },
  { id: 'c', name: 'Cherry' },
];

function renderAutocomplete(onSelect = vi.fn()) {
  const queryFn = vi.fn().mockResolvedValue(FRUITS);
  renderWithProviders(
    <AutocompleteInput<Fruit>
      queryFn={queryFn}
      queryKeyPrefix="fruit"
      onSelect={onSelect}
      getItemKey={(f) => f.id}
      getItemValue={(f) => f.name}
      renderItem={(f) => <span>{f.name}</span>}
      placeholder="Search fruit"
      minChars={1}
      // No debounce: this suite is about keyboard behaviour, and waiting out a
      // real debounce in every case only makes it slow and flaky.
      debounceMs={0}
    />
  );
  return { queryFn, onSelect };
}

describe('AutocompleteInput combobox pattern', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('announces itself as a combobox', () => {
    renderAutocomplete();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('reports collapsed before anything is typed', () => {
    renderAutocomplete();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });

  it('points at the listbox it controls', () => {
    renderAutocomplete();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-controls');
  });

  it('declares that suggestions are a list', () => {
    renderAutocomplete();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-autocomplete', 'list');
  });

  it('reports expanded once suggestions are showing', async () => {
    const user = userEvent.setup();
    renderAutocomplete();

    await user.type(screen.getByRole('combobox'), 'a');

    await waitFor(() =>
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true')
    );
  });

  it('moves a virtual cursor with the down arrow', async () => {
    const user = userEvent.setup();
    renderAutocomplete();
    const input = screen.getByRole('combobox');

    await user.type(input, 'a');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    await user.keyboard('{ArrowDown}');

    // DOM focus stays in the input; the cursor is announced through
    // aria-activedescendant, which is the whole point of the pattern.
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));
    expect(input).toHaveFocus();
  });

  it('wraps from the last option back to the first', async () => {
    const user = userEvent.setup();
    renderAutocomplete();
    const input = screen.getByRole('combobox');

    await user.type(input, 'a');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    const atLast = input.getAttribute('aria-activedescendant');
    await user.keyboard('{ArrowDown}');
    const wrapped = input.getAttribute('aria-activedescendant');

    expect(wrapped).not.toBe(atLast);
    expect(wrapped).toMatch(/option-0$/);
  });

  it('selects the highlighted option with Enter', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderAutocomplete();

    await user.type(screen.getByRole('combobox'), 'a');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledWith(FRUITS[0]);
  });

  it('leaves Enter to the form when nothing is highlighted', async () => {
    // A user typing free text and pressing Enter means to submit, not to pick
    // a suggestion they never moved to.
    const user = userEvent.setup();
    const { onSelect } = renderAutocomplete();

    await user.type(screen.getByRole('combobox'), 'a');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    await user.keyboard('{Enter}');

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('closes on Escape without selecting', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderAutocomplete();
    const input = screen.getByRole('combobox');

    await user.type(input, 'a');
    await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'true'));
    await user.keyboard('{ArrowDown}{Escape}');

    await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'false'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks options as options', async () => {
    const user = userEvent.setup();
    renderAutocomplete();

    await user.type(screen.getByRole('combobox'), 'a');

    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
  });

  it('marks exactly one option selected at a time', async () => {
    const user = userEvent.setup();
    renderAutocomplete();

    await user.type(screen.getByRole('combobox'), 'a');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
    await user.keyboard('{ArrowDown}');

    await waitFor(() => {
      const selected = screen
        .getAllByRole('option')
        .filter((o) => o.getAttribute('aria-selected') === 'true');
      expect(selected).toHaveLength(1);
    });
  });
});
