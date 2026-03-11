/**
 * Migration 0002: Affiliation tree structure.
 *
 * Replaces the flat `department` field on author affiliations with a recursive
 * `children` array supporting arbitrary institutional hierarchies.
 *
 * Affects:
 * - pub.chive.eprint.submission (rev 2 -> 3): authors[].affiliations[].department -> children
 * - pub.chive.actor.profile (rev 1 -> 2): affiliations[].department -> children
 *
 * @packageDocumentation
 */

import { registerMigration } from '../record-migrator.js';

interface LegacyAffiliation {
  name: string;
  institutionUri?: string;
  rorId?: string;
  department?: string;
}

interface MigratedAffiliation {
  name: string;
  institutionUri?: string;
  rorId?: string;
  children?: MigratedAffiliation[];
}

function migrateAffiliation(aff: LegacyAffiliation): MigratedAffiliation {
  // Already has children (new-format record without schemaRevision) - preserve as-is
  if ('children' in aff && (aff as Record<string, unknown>).children !== undefined) {
    const { department: _removed, ...rest } = aff as LegacyAffiliation & Record<string, unknown>;
    return rest as unknown as MigratedAffiliation;
  }
  // Spread to preserve any unknown/extra fields, then replace department with children
  const { department, ...rest } = aff as LegacyAffiliation & Record<string, unknown>;
  const result: MigratedAffiliation = { ...rest, name: aff.name };
  if (aff.institutionUri) result.institutionUri = aff.institutionUri;
  if (aff.rorId) result.rorId = aff.rorId;
  if (department) {
    result.children = [{ name: department }];
  }
  return result;
}

function migrateAffiliationsArray(affiliations: unknown): MigratedAffiliation[] | undefined {
  if (!Array.isArray(affiliations)) return undefined;
  return affiliations.map((aff) => migrateAffiliation(aff as LegacyAffiliation));
}

// pub.chive.eprint.submission: rev 2 -> 3
registerMigration({
  lexicon: 'pub.chive.eprint.submission',
  fromRevision: 2,
  toRevision: 3,
  description: 'Replace flat department field on author affiliations with recursive children tree',
  migrate: (record) => {
    const authors = record.authors as Record<string, unknown>[] | undefined;
    if (!authors) return record;

    return {
      ...record,
      authors: authors.map((author) => ({
        ...author,
        affiliations: migrateAffiliationsArray(author.affiliations) ?? author.affiliations,
      })),
    };
  },
});

// pub.chive.actor.profile: rev 1 -> 2
registerMigration({
  lexicon: 'pub.chive.actor.profile',
  fromRevision: 1,
  toRevision: 2,
  description: 'Replace flat department field on affiliations with recursive children tree',
  migrate: (record) => {
    const result: Record<string, unknown> = { ...record };

    if (record.affiliations) {
      result.affiliations = migrateAffiliationsArray(record.affiliations) ?? record.affiliations;
    }
    if (record.previousAffiliations) {
      result.previousAffiliations =
        migrateAffiliationsArray(record.previousAffiliations) ?? record.previousAffiliations;
    }

    return result;
  },
});
