/**
 * Every autocomplete implements the combobox pattern.
 *
 * @remarks
 * FE-5 counted around twenty autocompletes, of which two implemented the
 * WAI-ARIA combobox pattern. The rest offered their suggestions to a mouse
 * only.
 *
 * They get there two ways now: ten delegate to `AutocompleteInput`, which
 * implements it once; the rest render their own grouped list and adopt
 * `useCombobox`, which owns the keyboard and the ARIA wiring without touching
 * their markup.
 *
 * This test is the ratchet. A new autocomplete that does neither fails here
 * rather than shipping inaccessible.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FORMS_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Components that present a list of suggestions under a text field.
 *
 * @remarks
 * Named by file rather than detected, so adding one is a deliberate act.
 */
const AUTOCOMPLETES = readdirSync(FORMS_DIR)
  .filter((f) => f.endsWith('.tsx'))
  .filter((f) => !f.includes('.test.'))
  // Written as two predicates rather than one alternation: `/autocomplete|-input\.tsx$/`
  // anchors only its second branch, which reads as though the anchor applies to
  // both and is exactly the ambiguity CodeQL's missing-anchor rule flags.
  .filter((f) => f.includes('autocomplete') || f.endsWith('-input.tsx'))
  // The shared base implements the pattern directly; it is asserted separately.
  .filter((f) => f !== 'autocomplete-input.tsx');

describe('autocomplete accessibility coverage', () => {
  it('found the autocompletes to check', () => {
    expect(AUTOCOMPLETES.length).toBeGreaterThanOrEqual(10);
  });

  it.each(AUTOCOMPLETES)('%s implements the combobox pattern', (file) => {
    const source = readFileSync(join(FORMS_DIR, file), 'utf8');

    // Three legitimate ways to have the pattern, plus delegation to another
    // component in this directory that has it — `author-input` renders a
    // `DidAutocompleteInput` and no list of its own, so the accessible
    // combobox is the child's.
    const delegatesToBase = /<AutocompleteInput/.test(source);
    const usesHook = /useCombobox\(/.test(source);
    const implementsDirectly = /role="combobox"/.test(source);
    const delegatesToSibling = /<(Did)?AutocompleteInput|<NodeAutocomplete/.test(source);

    expect(
      delegatesToBase || usesHook || implementsDirectly || delegatesToSibling,
      `${file} has a suggestion list but no combobox pattern: it must delegate to ` +
        `AutocompleteInput, adopt useCombobox, or set role="combobox" itself`
    ).toBe(true);
  });

  it('the shared base implements it directly', () => {
    const source = readFileSync(join(FORMS_DIR, 'autocomplete-input.tsx'), 'utf8');
    expect(source).toMatch(/role="combobox"/);
    expect(source).toMatch(/aria-activedescendant/);
  });
});
