import { describe, it, expect } from 'vitest';

// Import migration registrations (side-effect: registers all migrations)
import '../../../../src/services/migration/index.js';

import {
  getCurrentRevision,
  getMigrations,
  migrateRecord,
  needsMigration,
} from '../../../../src/services/migration/record-migrator.js';

describe('record-migrator', () => {
  describe('getCurrentRevision', () => {
    it('returns 3 for pub.chive.eprint.submission', () => {
      expect(getCurrentRevision('pub.chive.eprint.submission')).toBe(3);
    });

    it('returns 2 for pub.chive.actor.profile', () => {
      expect(getCurrentRevision('pub.chive.actor.profile')).toBe(2);
    });

    it('returns 1 for unknown lexicons', () => {
      expect(getCurrentRevision('pub.chive.unknown.type')).toBe(1);
    });
  });

  describe('needsMigration', () => {
    it('returns true for record without schemaRevision', () => {
      expect(needsMigration('pub.chive.eprint.submission', { title: 'Test' })).toBe(true);
    });

    it('returns true for record at revision 1', () => {
      expect(
        needsMigration('pub.chive.eprint.submission', {
          title: 'Test',
          schemaRevision: 1,
        })
      ).toBe(true);
    });

    it('returns true for record at revision 2 (not yet at current 3)', () => {
      expect(
        needsMigration('pub.chive.eprint.submission', {
          title: 'Test',
          schemaRevision: 2,
        })
      ).toBe(true);
    });

    it('returns false for record already at current revision', () => {
      expect(
        needsMigration('pub.chive.eprint.submission', {
          title: 'Test',
          schemaRevision: 3,
        })
      ).toBe(false);
    });

    it('returns false for unknown lexicons (default revision 1)', () => {
      expect(needsMigration('pub.chive.unknown.type', { title: 'Test' })).toBe(false);
    });
  });

  describe('getMigrations', () => {
    it('returns two migrations for pub.chive.eprint.submission', () => {
      const m = getMigrations('pub.chive.eprint.submission');
      expect(m).toHaveLength(2);
      expect(m[0]!.fromRevision).toBe(1);
      expect(m[0]!.toRevision).toBe(2);
      expect(m[1]!.fromRevision).toBe(2);
      expect(m[1]!.toRevision).toBe(3);
    });

    it('returns one migration for pub.chive.actor.profile', () => {
      const m = getMigrations('pub.chive.actor.profile');
      expect(m).toHaveLength(1);
      expect(m[0]!.fromRevision).toBe(1);
      expect(m[0]!.toRevision).toBe(2);
    });

    it('returns empty array for unknown lexicons', () => {
      expect(getMigrations('pub.chive.unknown.type')).toHaveLength(0);
    });
  });

  describe('migrateRecord', () => {
    it('returns record unchanged if already at current revision', () => {
      const record = { title: 'Test', schemaRevision: 3 };
      const result = migrateRecord('pub.chive.eprint.submission', record);
      expect(result).toBe(record); // Same reference, not copied
    });

    it('returns record unchanged for unknown lexicons', () => {
      const record = { title: 'Test' };
      const result = migrateRecord('pub.chive.unknown.type', record);
      expect(result).toBe(record);
    });

    it('does not mutate the input record', () => {
      const record = {
        abstract: 'Plain text abstract',
        authors: [
          {
            name: 'Alice',
            affiliations: [{ name: 'MIT', department: 'CS' }],
          },
        ],
      };
      const original = JSON.parse(JSON.stringify(record));
      migrateRecord('pub.chive.eprint.submission', record);
      expect(record).toEqual(original);
    });

    it('sets schemaRevision to 3 after full submission migration', () => {
      const record = { authors: [] };
      const result = migrateRecord('pub.chive.eprint.submission', record);
      expect(result.schemaRevision).toBe(3);
    });
  });
});

describe('0001-rich-text-and-license migration', () => {
  describe('abstract: string to rich text array', () => {
    it('converts plain string abstract to RichTextItem array', () => {
      const record = {
        abstract: 'This is a plain text abstract.',
        schemaRevision: 1,
      };
      const result = migrateRecord('pub.chive.eprint.submission', record);
      expect(result.abstract).toEqual([
        {
          $type: 'pub.chive.richtext.defs#textItem',
          type: 'text',
          content: 'This is a plain text abstract.',
        },
      ]);
    });

    it('sets abstractPlainText when converting string abstract', () => {
      const record = {
        abstract: 'Plain abstract',
        schemaRevision: 1,
      };
      const result = migrateRecord('pub.chive.eprint.submission', record);
      expect(result.abstractPlainText).toBe('Plain abstract');
    });

    it('does not overwrite existing abstractPlainText', () => {
      const record = {
        abstract: 'New abstract',
        abstractPlainText: 'Original plain text',
        schemaRevision: 1,
      };
      const result = migrateRecord('pub.chive.eprint.submission', record);
      expect(result.abstractPlainText).toBe('Original plain text');
    });

    it('leaves array abstract unchanged', () => {
      const record = {
        abstract: [
          { $type: 'pub.chive.richtext.defs#textItem', type: 'text', content: 'Already migrated' },
        ],
        schemaRevision: 1,
      };
      const result = migrateRecord('pub.chive.eprint.submission', record);
      expect(result.abstract).toEqual([
        { $type: 'pub.chive.richtext.defs#textItem', type: 'text', content: 'Already migrated' },
      ]);
    });
  });

  describe('title: LaTeX to titleRich', () => {
    it('adds titleRich for title containing inline LaTeX', () => {
      const record = {
        title: 'A study of $\\alpha$ decay',
        schemaRevision: 1,
      };
      const result = migrateRecord('pub.chive.eprint.submission', record);
      expect(result.titleRich).toEqual([
        { $type: 'pub.chive.richtext.defs#textItem', type: 'text', content: 'A study of ' },
        {
          $type: 'pub.chive.richtext.defs#latexItem',
          type: 'latex',
          content: '\\alpha',
          displayMode: false,
        },
        { $type: 'pub.chive.richtext.defs#textItem', type: 'text', content: ' decay' },
      ]);
    });

    it('adds titleRich for title containing display-mode LaTeX', () => {
      const record = {
        title: 'Results for $$E=mc^2$$',
        schemaRevision: 1,
      };
      const result = migrateRecord('pub.chive.eprint.submission', record);
      const latexItem = (result.titleRich as Record<string, unknown>[]).find(
        (item) => item.type === 'latex'
      );
      expect(latexItem).toEqual({
        $type: 'pub.chive.richtext.defs#latexItem',
        type: 'latex',
        content: 'E=mc^2',
        displayMode: true,
      });
    });

    it('does not add titleRich for plain text title', () => {
      const record = {
        title: 'A Plain Title Without Math',
        schemaRevision: 1,
      };
      const result = migrateRecord('pub.chive.eprint.submission', record);
      expect(result.titleRich).toBeUndefined();
    });

    it('does not overwrite existing titleRich', () => {
      const record = {
        title: '$x$ and $y$',
        titleRich: [{ type: 'text', content: 'Already set' }],
        schemaRevision: 1,
      };
      const result = migrateRecord('pub.chive.eprint.submission', record);
      expect(result.titleRich).toEqual([{ type: 'text', content: 'Already set' }]);
    });
  });

  describe('license: slug to URI', () => {
    it('adds licenseUri from known slug', () => {
      const record = {
        licenseSlug: 'CC-BY-4.0',
        schemaRevision: 1,
      };
      const result = migrateRecord('pub.chive.eprint.submission', record);
      expect(result.licenseUri).toBe(
        'at://did:plc:chive-governance/pub.chive.graph.node/fc58b045-e186-5081-b7eb-abc5c47ea8a3'
      );
    });

    it('normalizes legacy license field to licenseSlug', () => {
      const record = {
        license: 'CC0-1.0',
        schemaRevision: 1,
      };
      const result = migrateRecord('pub.chive.eprint.submission', record);
      expect(result.licenseSlug).toBe('CC0-1.0');
      expect(result.license).toBeUndefined();
      expect(result.licenseUri).toBe(
        'at://did:plc:chive-governance/pub.chive.graph.node/509414c0-d77f-5053-a774-61fe1bf97dca'
      );
    });

    it('does not overwrite existing licenseUri', () => {
      const record = {
        licenseSlug: 'CC-BY-4.0',
        licenseUri: 'at://custom/uri',
        schemaRevision: 1,
      };
      const result = migrateRecord('pub.chive.eprint.submission', record);
      expect(result.licenseUri).toBe('at://custom/uri');
    });

    it('leaves unknown license slugs without URI', () => {
      const record = {
        licenseSlug: 'UNKNOWN-LICENSE',
        schemaRevision: 1,
      };
      const result = migrateRecord('pub.chive.eprint.submission', record);
      expect(result.licenseUri).toBeUndefined();
    });
  });
});

describe('0002-affiliation-tree migration', () => {
  describe('eprint submission', () => {
    it('converts department to children on author affiliations', () => {
      const record = {
        title: 'Test Paper',
        schemaRevision: 2,
        authors: [
          {
            name: 'Alice',
            affiliations: [
              { name: 'MIT', department: 'Computer Science', rorId: 'https://ror.org/042nb2s44' },
            ],
          },
        ],
      };

      const result = migrateRecord('pub.chive.eprint.submission', record);
      const authors = result.authors as Record<string, unknown>[];
      const affiliations = authors[0]!.affiliations as Record<string, unknown>[];

      expect(affiliations[0]).toEqual({
        name: 'MIT',
        rorId: 'https://ror.org/042nb2s44',
        children: [{ name: 'Computer Science' }],
      });
      expect(affiliations[0]).not.toHaveProperty('department');
    });

    it('handles affiliations without department', () => {
      const record = {
        schemaRevision: 2,
        authors: [
          {
            name: 'Bob',
            affiliations: [{ name: 'Stanford', rorId: 'https://ror.org/00f54p054' }],
          },
        ],
      };

      const result = migrateRecord('pub.chive.eprint.submission', record);
      const authors = result.authors as Record<string, unknown>[];
      const affiliations = authors[0]!.affiliations as Record<string, unknown>[];

      expect(affiliations[0]).toEqual({
        name: 'Stanford',
        rorId: 'https://ror.org/00f54p054',
      });
      expect(affiliations[0]).not.toHaveProperty('children');
      expect(affiliations[0]).not.toHaveProperty('department');
    });

    it('preserves institutionUri', () => {
      const record = {
        schemaRevision: 2,
        authors: [
          {
            name: 'Carol',
            affiliations: [
              {
                name: 'MIT',
                institutionUri: 'at://did:plc:abc/pub.chive.graph.node/mit',
                department: 'CSAIL',
              },
            ],
          },
        ],
      };

      const result = migrateRecord('pub.chive.eprint.submission', record);
      const authors = result.authors as Record<string, unknown>[];
      const affiliations = authors[0]!.affiliations as Record<string, unknown>[];

      expect(affiliations[0]!.institutionUri).toBe('at://did:plc:abc/pub.chive.graph.node/mit');
      expect(affiliations[0]!.children).toEqual([{ name: 'CSAIL' }]);
    });

    it('returns record unchanged if no authors', () => {
      const record = { title: 'No authors', schemaRevision: 2 };
      const result = migrateRecord('pub.chive.eprint.submission', record);
      expect(result.title).toBe('No authors');
      expect(result.schemaRevision).toBe(3);
    });

    it('preserves existing children on records missing schemaRevision', () => {
      const record = {
        schemaRevision: 2,
        authors: [
          {
            name: 'Dana',
            affiliations: [
              {
                name: 'UofR',
                children: [{ name: 'School of Arts', children: [{ name: 'Linguistics' }] }],
              },
            ],
          },
        ],
      };

      const result = migrateRecord('pub.chive.eprint.submission', record);
      const authors = result.authors as Record<string, unknown>[];
      const affiliations = authors[0]!.affiliations as Record<string, unknown>[];

      expect(affiliations[0]).toEqual({
        name: 'UofR',
        children: [{ name: 'School of Arts', children: [{ name: 'Linguistics' }] }],
      });
    });

    it('preserves unknown extra fields on affiliations', () => {
      const record = {
        schemaRevision: 2,
        authors: [
          {
            name: 'Eve',
            affiliations: [{ name: 'MIT', department: 'CS', customField: 'value' }],
          },
        ],
      };

      const result = migrateRecord('pub.chive.eprint.submission', record);
      const authors = result.authors as Record<string, unknown>[];
      const affiliations = authors[0]!.affiliations as Record<string, unknown>[];

      expect(affiliations[0]!.customField).toBe('value');
      expect(affiliations[0]!.children).toEqual([{ name: 'CS' }]);
      expect(affiliations[0]).not.toHaveProperty('department');
    });
  });

  describe('actor profile', () => {
    it('converts department to children on affiliations', () => {
      const record = {
        displayName: 'Alice',
        affiliations: [{ name: 'MIT', department: 'EECS' }],
      };

      const result = migrateRecord('pub.chive.actor.profile', record);
      const affiliations = result.affiliations as Record<string, unknown>[];

      expect(affiliations[0]).toEqual({
        name: 'MIT',
        children: [{ name: 'EECS' }],
      });
    });

    it('converts department to children on previousAffiliations', () => {
      const record = {
        displayName: 'Bob',
        previousAffiliations: [
          { name: 'Stanford', department: 'CS', rorId: 'https://ror.org/00f54p054' },
        ],
      };

      const result = migrateRecord('pub.chive.actor.profile', record);
      const prevAffs = result.previousAffiliations as Record<string, unknown>[];

      expect(prevAffs[0]).toEqual({
        name: 'Stanford',
        rorId: 'https://ror.org/00f54p054',
        children: [{ name: 'CS' }],
      });
    });

    it('handles profile with no affiliations', () => {
      const record = { displayName: 'Carol' };
      const result = migrateRecord('pub.chive.actor.profile', record);
      expect(result.displayName).toBe('Carol');
      expect(result.schemaRevision).toBe(2);
    });

    it('falls back to original if affiliations is not an array', () => {
      const record = {
        displayName: 'Dave',
        affiliations: 'MIT',
      };
      const result = migrateRecord('pub.chive.actor.profile', record);
      expect(result.affiliations).toBe('MIT');
    });
  });
});

describe('migration chaining (rev 1 -> 2 -> 3)', () => {
  it('applies both migrations in sequence for a v1 submission record', () => {
    const record = {
      title: 'A study of $\\alpha$ particles',
      abstract: 'We investigate alpha particle interactions.',
      license: 'CC-BY-4.0',
      authors: [
        {
          name: 'Alice',
          affiliations: [
            { name: 'MIT', department: 'Physics', rorId: 'https://ror.org/042nb2s44' },
          ],
        },
      ],
    };

    const result = migrateRecord('pub.chive.eprint.submission', record);

    // From 0001: abstract converted to rich text
    expect(result.abstract).toEqual([
      {
        $type: 'pub.chive.richtext.defs#textItem',
        type: 'text',
        content: 'We investigate alpha particle interactions.',
      },
    ]);
    expect(result.abstractPlainText).toBe('We investigate alpha particle interactions.');

    // From 0001: titleRich added for LaTeX title
    expect(result.titleRich).toBeDefined();
    const titleRich = result.titleRich as Record<string, unknown>[];
    expect(titleRich.some((item) => item.type === 'latex' && item.content === '\\alpha')).toBe(
      true
    );

    // From 0001: license normalized
    expect(result.licenseSlug).toBe('CC-BY-4.0');
    expect(result.license).toBeUndefined();
    expect(result.licenseUri).toBe(
      'at://did:plc:chive-governance/pub.chive.graph.node/fc58b045-e186-5081-b7eb-abc5c47ea8a3'
    );

    // From 0002: department converted to children
    const authors = result.authors as Record<string, unknown>[];
    const affiliations = authors[0]!.affiliations as Record<string, unknown>[];
    expect(affiliations[0]).toEqual({
      name: 'MIT',
      rorId: 'https://ror.org/042nb2s44',
      children: [{ name: 'Physics' }],
    });
    expect(affiliations[0]).not.toHaveProperty('department');

    // Final revision
    expect(result.schemaRevision).toBe(3);
  });

  it('applies only 0002 for a record already at revision 2', () => {
    const record = {
      abstract: [
        { $type: 'pub.chive.richtext.defs#textItem', type: 'text', content: 'Already migrated' },
      ],
      schemaRevision: 2,
      authors: [
        {
          name: 'Bob',
          affiliations: [{ name: 'Stanford', department: 'CS' }],
        },
      ],
    };

    const result = migrateRecord('pub.chive.eprint.submission', record);

    // Abstract left alone (already array)
    expect(result.abstract).toEqual([
      { $type: 'pub.chive.richtext.defs#textItem', type: 'text', content: 'Already migrated' },
    ]);

    // Affiliation migrated
    const authors = result.authors as Record<string, unknown>[];
    const affiliations = authors[0]!.affiliations as Record<string, unknown>[];
    expect(affiliations[0]).toEqual({
      name: 'Stanford',
      children: [{ name: 'CS' }],
    });

    expect(result.schemaRevision).toBe(3);
  });
});
