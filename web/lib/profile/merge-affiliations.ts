/**
 * Merges the affiliations a researcher has recorded in more than one place.
 *
 * @remarks
 * A researcher's institutions can be stated twice: in their Chive profile
 * (`pub.chive.actor.profile.affiliations`, a tree of institution and sub-units)
 * and in their sifa.id profile (`id.sifa.profile.position` and `.education`, a
 * flat institution with a job title and dates). Rendering both produced the
 * same university twice on one page, once under "Affiliations" and again under
 * a separate "Professional profile" card.
 *
 * This merges them on the institution, so each institution appears once
 * carrying whatever each source knows about it:
 *
 * - Chive contributes the **sub-units** — the school and department beneath the
 *   institution — and any ROR identifier.
 * - sifa contributes the **role**: job title or degree, and the years.
 *
 * Matching is on a normalised institution name. It is deliberately
 * conservative: case, punctuation, a leading "the" and repeated whitespace are
 * ignored, but nothing is guessed. "Univ. of Rochester" will not match
 * "University of Rochester", and the cost of that is one extra row rather than
 * a wrong merge that attributes a department to the wrong employer.
 *
 * Current and previous are kept apart because they mean different things, and
 * an institution can legitimately be in both — someone who returns to a former
 * employer.
 *
 * @packageDocumentation
 */

import type { Affiliation } from '@/lib/api/schema';
import type { SifaRole } from '@/lib/api/generated/types/pub/chive/author/getProfile';
import { getAffiliationDisplay } from '@/lib/utils/affiliation';

/**
 * One institution, with everything known about it from any source.
 *
 * @public
 */
export interface MergedAffiliation {
  /** Institution name, as the first source to mention it wrote it */
  readonly institution: string;
  /** Sub-units beneath the institution, from the Chive profile */
  readonly units: readonly string[];
  /** Job title or degree, from sifa */
  readonly title?: string;
  /** Years the role covers, already formatted */
  readonly span?: string;
  /** Whether this is the primary affiliation */
  readonly isPrimary: boolean;
  /** Which sources mentioned this institution */
  readonly sources: readonly ('chive' | 'sifa')[];
}

/**
 * Normalises an institution name for matching.
 *
 * @remarks
 * Not for display — only for deciding whether two names denote the same
 * institution.
 */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats the years a role covers.
 *
 * @remarks
 * sifa dates are ISO strings; beside a job title only the year is worth
 * showing. A role with neither date formats to nothing rather than to a stray
 * dash.
 */
export function formatSpan(role: { startedAt?: string; endedAt?: string }): string | undefined {
  const from = role.startedAt?.slice(0, 4);
  const to = role.endedAt?.slice(0, 4);

  if (from && to) return `${from}–${to}`;
  if (from) return `${from}–present`;
  if (to) return `until ${to}`;
  return undefined;
}

/**
 * Merges Chive affiliations and sifa roles into one list per institution.
 *
 * @param affiliations - Chive profile affiliations, a tree per institution
 * @param roles - sifa roles for the same period (current or previous)
 * @param primaryIsFirst - Treat the first Chive affiliation as primary
 * @returns One entry per institution, Chive's order first
 *
 * @public
 */
export function mergeAffiliations(
  affiliations: readonly Affiliation[] | undefined,
  roles: readonly SifaRole[] | undefined,
  primaryIsFirst = false
): MergedAffiliation[] {
  const byKey = new Map<string, MergedAffiliation>();
  const order: string[] = [];

  for (const [index, aff] of (affiliations ?? []).entries()) {
    const { institution, units } = getAffiliationDisplay(aff);
    const key = normalize(institution);
    if (!byKey.has(key)) order.push(key);
    byKey.set(key, {
      institution,
      units,
      isPrimary: primaryIsFirst && index === 0,
      sources: ['chive'],
    });
  }

  for (const role of roles ?? []) {
    const key = normalize(role.institution);
    const existing = byKey.get(key);

    if (existing) {
      // The institution is already listed; sifa adds the role, not a new row.
      byKey.set(key, {
        ...existing,
        ...(existing.title ? {} : role.title ? { title: role.title } : {}),
        ...(existing.span
          ? {}
          : (() => {
              const span = formatSpan(role);
              return span ? { span } : {};
            })()),
        isPrimary: existing.isPrimary || role.isPrimary === true,
        sources: existing.sources.includes('sifa')
          ? existing.sources
          : [...existing.sources, 'sifa'],
      });
      continue;
    }

    order.push(key);
    const span = formatSpan(role);
    byKey.set(key, {
      institution: role.institution,
      units: [],
      ...(role.title ? { title: role.title } : {}),
      ...(span ? { span } : {}),
      isPrimary: role.isPrimary === true,
      sources: ['sifa'],
    });
  }

  return order.flatMap((key) => {
    const entry = byKey.get(key);
    return entry ? [entry] : [];
  });
}
