import { describe, it, expect, beforeEach } from 'vitest';
import { MigrationRegistry } from '../registry';
import {
  eprintMigrations,
  registerEprintMigrations,
  containsLatex,
  parseTitleToRichText,
  LICENSE_URI_MAP,
} from '../eprint-migrations';

describe('Eprint Migrations', () => {
  describe('containsLatex', () => {
    it('detects inline math', () => {
      expect(containsLatex('Analysis of $\\alpha$-decay')).toBe(true);
      expect(containsLatex('Value is $x^2 + y^2$')).toBe(true);
    });

    it('detects display math', () => {
      expect(containsLatex('Equation: $$\\sum_{i=1}^n x_i$$')).toBe(true);
    });

    it('detects LaTeX commands', () => {
      expect(containsLatex('Using \\frac{1}{2} method')).toBe(true);
      expect(containsLatex('Compute \\sqrt{x}')).toBe(true);
      expect(containsLatex('The \\int of f(x)')).toBe(true);
      expect(containsLatex('Calculate \\sum of terms')).toBe(true);
      expect(containsLatex('Find \\lim as n approaches infinity')).toBe(true);
    });

    it('detects Greek letters', () => {
      expect(containsLatex('The \\alpha parameter')).toBe(true);
      expect(containsLatex('Using \\beta decay')).toBe(true);
      expect(containsLatex('Value of \\pi')).toBe(true);
      expect(containsLatex('Standard \\sigma deviation')).toBe(true);
    });

    it('detects subscripts and superscripts', () => {
      expect(containsLatex('Variable x_{ij}')).toBe(true);
      expect(containsLatex('Power x^{n+1}')).toBe(true);
    });

    it('returns false for plain text', () => {
      expect(containsLatex('Simple Title')).toBe(false);
      expect(containsLatex('A Study of Machine Learning')).toBe(false);
      expect(containsLatex('2023 Analysis of Data')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(containsLatex('')).toBe(false);
    });
  });

  describe('parseTitleToRichText', () => {
    it('parses plain text', () => {
      const result = parseTitleToRichText('Simple Title');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        $type: 'pub.chive.eprint.submission#textItem',
        type: 'text',
        content: 'Simple Title',
      });
    });

    it('parses single inline math expression', () => {
      const result = parseTitleToRichText('Value of $\\alpha$');
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ type: 'text', content: 'Value of ' });
      expect(result[1]).toMatchObject({
        type: 'latex',
        content: '\\alpha',
        displayMode: false,
      });
    });

    it('parses text before and after math', () => {
      const result = parseTitleToRichText('Study of $\\beta$-particles');
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ type: 'text', content: 'Study of ' });
      expect(result[1]).toMatchObject({ type: 'latex', content: '\\beta' });
      expect(result[2]).toMatchObject({ type: 'text', content: '-particles' });
    });

    it('parses multiple math expressions', () => {
      const result = parseTitleToRichText('Comparing $\\alpha$ and $\\beta$ values');
      expect(result).toHaveLength(5);
      expect(result[0]).toMatchObject({ type: 'text', content: 'Comparing ' });
      expect(result[1]).toMatchObject({ type: 'latex', content: '\\alpha' });
      expect(result[2]).toMatchObject({ type: 'text', content: ' and ' });
      expect(result[3]).toMatchObject({ type: 'latex', content: '\\beta' });
      expect(result[4]).toMatchObject({ type: 'text', content: ' values' });
    });

    it('parses display math', () => {
      const result = parseTitleToRichText('Equation $$x^2 + y^2$$ analysis');
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ type: 'text', content: 'Equation ' });
      expect(result[1]).toMatchObject({
        type: 'latex',
        content: 'x^2 + y^2',
        displayMode: true,
      });
      expect(result[2]).toMatchObject({ type: 'text', content: ' analysis' });
    });

    it('handles empty string', () => {
      const result = parseTitleToRichText('');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ type: 'text', content: '' });
    });

    it('handles math at start of title', () => {
      const result = parseTitleToRichText('$\\pi$ calculation method');
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ type: 'latex', content: '\\pi' });
      expect(result[1]).toMatchObject({ type: 'text', content: ' calculation method' });
    });

    it('handles math at end of title', () => {
      const result = parseTitleToRichText('Analysis of $\\sigma$');
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ type: 'text', content: 'Analysis of ' });
      expect(result[1]).toMatchObject({ type: 'latex', content: '\\sigma' });
    });
  });

  describe('LICENSE_URI_MAP', () => {
    it('contains CC-BY-4.0', () => {
      expect(LICENSE_URI_MAP['CC-BY-4.0']).toBeDefined();
      expect(LICENSE_URI_MAP['CC-BY-4.0']).toContain('at://');
    });

    it('contains CC-BY-SA-4.0', () => {
      expect(LICENSE_URI_MAP['CC-BY-SA-4.0']).toBeDefined();
    });

    it('contains CC0-1.0', () => {
      expect(LICENSE_URI_MAP['CC0-1.0']).toBeDefined();
    });

    it('contains MIT', () => {
      expect(LICENSE_URI_MAP['MIT']).toBeDefined();
    });

    it('contains Apache-2.0', () => {
      expect(LICENSE_URI_MAP['Apache-2.0']).toBeDefined();
    });
  });

  describe('Abstract String to Rich Text Migration', () => {
    let registry: MigrationRegistry;

    beforeEach(() => {
      registry = new MigrationRegistry();
      const abstractMigration = eprintMigrations.find(
        (m) => m.id === 'eprint-abstract-string-to-rich-text'
      );
      if (abstractMigration) {
        registry.register(abstractMigration);
      }
    });

    it('detects string abstract needing migration', () => {
      const record = {
        title: 'Test',
        abstract: 'This is a plain text abstract',
      };

      const detection = registry.detectMigrations('pub.chive.eprint.submission', record);
      expect(detection.needsMigration).toBe(true);
    });

    it('does not detect array abstract as needing migration', () => {
      const record = {
        title: 'Test',
        abstract: [{ type: 'text', content: 'Rich text abstract' }],
      };

      const detection = registry.detectMigrations('pub.chive.eprint.submission', record);
      expect(detection.needsMigration).toBe(false);
    });

    it('migrates string abstract to rich text array', () => {
      const record = {
        title: 'Test',
        abstract: 'This is a plain text abstract',
      };

      const result = registry.applyMigrations<Record<string, unknown>>(
        'pub.chive.eprint.submission',
        record
      );
      expect(result.success).toBe(true);
      expect(Array.isArray(result.record?.abstract)).toBe(true);
      const abstract = result.record?.abstract as Array<{ type: string; content: string }>;
      expect(abstract[0]).toMatchObject({
        type: 'text',
        content: 'This is a plain text abstract',
      });
    });

    it('preserves abstractPlainText if already set', () => {
      const record = {
        title: 'Test',
        abstract: 'New abstract',
        abstractPlainText: 'Old plain text',
      };

      const result = registry.applyMigrations<Record<string, unknown>>(
        'pub.chive.eprint.submission',
        record
      );
      expect(result.record?.abstractPlainText).toBe('Old plain text');
    });

    it('sets abstractPlainText from abstract if not set', () => {
      const record = {
        title: 'Test',
        abstract: 'My abstract text',
      };

      const result = registry.applyMigrations<Record<string, unknown>>(
        'pub.chive.eprint.submission',
        record
      );
      expect(result.record?.abstractPlainText).toBe('My abstract text');
    });
  });

  describe('Title LaTeX to Rich Text Migration', () => {
    let registry: MigrationRegistry;

    beforeEach(() => {
      registry = new MigrationRegistry();
      const titleMigration = eprintMigrations.find(
        (m) => m.id === 'eprint-title-latex-to-rich-text'
      );
      if (titleMigration) {
        registry.register(titleMigration);
      }
    });

    it('detects title with LaTeX needing migration', () => {
      const record = {
        title: 'Study of $\\alpha$ decay',
        abstract: [],
      };

      const detection = registry.detectMigrations('pub.chive.eprint.submission', record);
      expect(detection.needsMigration).toBe(true);
    });

    it('does not detect plain title as needing migration', () => {
      const record = {
        title: 'Simple Title Without LaTeX',
        abstract: [],
      };

      const detection = registry.detectMigrations('pub.chive.eprint.submission', record);
      expect(detection.needsMigration).toBe(false);
    });

    it('does not detect title with existing titleRich as needing migration', () => {
      const record = {
        title: 'Study of $\\alpha$ decay',
        titleRich: [{ type: 'text', content: 'Study of ' }],
        abstract: [],
      };

      const detection = registry.detectMigrations('pub.chive.eprint.submission', record);
      expect(detection.needsMigration).toBe(false);
    });

    it('migrates title with LaTeX to rich text array', () => {
      const record = {
        title: 'Study of $\\alpha$ decay',
        abstract: [],
      };

      const result = registry.applyMigrations<Record<string, unknown>>(
        'pub.chive.eprint.submission',
        record
      );
      expect(result.success).toBe(true);
      expect(Array.isArray(result.record?.titleRich)).toBe(true);
      const titleRich = result.record?.titleRich as Array<unknown>;
      expect(titleRich).toHaveLength(3);
    });

    it('preserves original title field', () => {
      const record = {
        title: 'Study of $\\alpha$ decay',
        abstract: [],
      };

      const result = registry.applyMigrations<Record<string, unknown>>(
        'pub.chive.eprint.submission',
        record
      );
      expect(result.record?.title).toBe('Study of $\\alpha$ decay');
    });
  });

  describe('License Slug to URI Migration', () => {
    let registry: MigrationRegistry;

    beforeEach(() => {
      registry = new MigrationRegistry();
      const licenseMigration = eprintMigrations.find((m) => m.id === 'eprint-license-slug-to-uri');
      if (licenseMigration) {
        registry.register(licenseMigration);
      }
    });

    it('detects license slug without URI needing migration', () => {
      const record = {
        title: 'Test',
        abstract: [],
        licenseSlug: 'CC-BY-4.0',
      };

      const detection = registry.detectMigrations('pub.chive.eprint.submission', record);
      expect(detection.needsMigration).toBe(true);
    });

    it('does not detect license with existing URI as needing migration', () => {
      const record = {
        title: 'Test',
        abstract: [],
        licenseSlug: 'CC-BY-4.0',
        licenseUri: 'at://did:plc:governance/pub.chive.graph.node/abc',
      };

      const detection = registry.detectMigrations('pub.chive.eprint.submission', record);
      expect(detection.needsMigration).toBe(false);
    });

    it('does not detect unknown license slug as needing migration', () => {
      const record = {
        title: 'Test',
        abstract: [],
        licenseSlug: 'UNKNOWN-LICENSE',
      };

      const detection = registry.detectMigrations('pub.chive.eprint.submission', record);
      expect(detection.needsMigration).toBe(false);
    });

    it('migrates CC-BY-4.0 to include URI', () => {
      const record = {
        title: 'Test',
        abstract: [],
        licenseSlug: 'CC-BY-4.0',
      };

      const result = registry.applyMigrations<Record<string, unknown>>(
        'pub.chive.eprint.submission',
        record
      );
      expect(result.success).toBe(true);
      expect(result.record?.licenseUri).toBe(LICENSE_URI_MAP['CC-BY-4.0']);
      expect(result.record?.licenseSlug).toBe('CC-BY-4.0');
    });

    it('migrates CC0-1.0 to include URI', () => {
      const record = {
        title: 'Test',
        abstract: [],
        licenseSlug: 'CC0-1.0',
      };

      const result = registry.applyMigrations<Record<string, unknown>>(
        'pub.chive.eprint.submission',
        record
      );
      expect(result.success).toBe(true);
      expect(result.record?.licenseUri).toBe(LICENSE_URI_MAP['CC0-1.0']);
    });

    it('detects old "license" field name needing migration', () => {
      const record = {
        title: 'Test',
        abstract: [],
        license: 'CC-BY-4.0',
      };

      const detection = registry.detectMigrations('pub.chive.eprint.submission', record);
      expect(detection.needsMigration).toBe(true);
    });

    it('migrates old "license" field to licenseSlug and adds URI', () => {
      const record = {
        title: 'Test',
        abstract: [],
        license: 'CC-BY-4.0',
      };

      const result = registry.applyMigrations<Record<string, unknown>>(
        'pub.chive.eprint.submission',
        record
      );
      expect(result.success).toBe(true);
      expect(result.record?.licenseUri).toBe(LICENSE_URI_MAP['CC-BY-4.0']);
      expect(result.record?.licenseSlug).toBe('CC-BY-4.0');
      // Old field name should be removed
      expect(result.record?.license).toBeUndefined();
    });

    it('handles case-insensitive license slug', () => {
      const record = {
        title: 'Test',
        abstract: [],
        license: 'cc-by-4.0',
      };

      const detection = registry.detectMigrations('pub.chive.eprint.submission', record);
      expect(detection.needsMigration).toBe(true);

      const result = registry.applyMigrations<Record<string, unknown>>(
        'pub.chive.eprint.submission',
        record
      );
      expect(result.success).toBe(true);
      expect(result.record?.licenseUri).toBe(LICENSE_URI_MAP['CC-BY-4.0']);
      expect(result.record?.licenseSlug).toBe('CC-BY-4.0');
    });
  });

  describe('registerEprintMigrations', () => {
    it('registers all migrations without error', () => {
      // Create a fresh registry to test
      const registry = new MigrationRegistry();

      // Manually register to test
      for (const migration of eprintMigrations) {
        registry.register(migration);
      }

      expect(registry.getAllMigrations()).toHaveLength(eprintMigrations.length);
    });

    it('handles duplicate registration gracefully', () => {
      // This should not throw even if called multiple times
      expect(() => {
        registerEprintMigrations();
        registerEprintMigrations();
      }).not.toThrow();
    });
  });

  describe('Combined Migrations', () => {
    let registry: MigrationRegistry;

    beforeEach(() => {
      registry = new MigrationRegistry();
      for (const migration of eprintMigrations) {
        registry.register(migration);
      }
    });

    it('applies all applicable migrations to a legacy record', () => {
      const legacyRecord = {
        title: 'Analysis of $\\alpha$-particles',
        abstract: 'This is a plain text abstract about particles.',
        licenseSlug: 'CC-BY-4.0',
        authors: [],
        document: { $type: 'blob', ref: { $link: 'abc' }, mimeType: 'application/pdf', size: 1000 },
        createdAt: '2024-01-01T00:00:00Z',
      };

      const detection = registry.detectMigrations('pub.chive.eprint.submission', legacyRecord);
      expect(detection.needsMigration).toBe(true);
      expect(detection.migrations.length).toBeGreaterThanOrEqual(3);

      const result = registry.applyMigrations<Record<string, unknown>>(
        'pub.chive.eprint.submission',
        legacyRecord
      );
      expect(result.success).toBe(true);

      // Check abstract was migrated
      expect(Array.isArray(result.record?.abstract)).toBe(true);

      // Check title was migrated
      expect(Array.isArray(result.record?.titleRich)).toBe(true);

      // Check license was migrated
      expect(result.record?.licenseUri).toBeDefined();
    });

    it('preserves other fields during migration', () => {
      const record = {
        title: 'Test',
        abstract: 'Plain abstract',
        authors: [{ name: 'Test Author' }],
        keywords: ['test', 'keyword'],
        createdAt: '2024-01-01T00:00:00Z',
        document: { $type: 'blob', ref: { $link: 'abc' }, mimeType: 'application/pdf', size: 1000 },
      };

      const result = registry.applyMigrations<Record<string, unknown>>(
        'pub.chive.eprint.submission',
        record
      );
      expect(result.success).toBe(true);
      expect(result.record?.authors).toEqual([{ name: 'Test Author' }]);
      expect(result.record?.keywords).toEqual(['test', 'keyword']);
      expect(result.record?.createdAt).toBe('2024-01-01T00:00:00Z');
    });
  });
});
