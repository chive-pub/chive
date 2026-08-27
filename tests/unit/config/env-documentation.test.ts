/**
 * Unit tests asserting every environment variable the code reads is documented.
 *
 * @remarks
 * The code read roughly 103 environment variables; `.env.example` documented 30.
 * The other 75 could only be discovered by grepping for `process.env`, which
 * meant an operator had no way to know a knob existed — and several of them name
 * capabilities that are not wired up at all, so setting them has no effect. That
 * combination is worse than being undocumented: it invites someone to configure
 * a CDN, an SMTP server or a governance PDS and conclude the system is broken
 * when nothing happens.
 *
 * This test is the thing that keeps the file honest. Adding a `process.env` read
 * without documenting it now fails here rather than being noticed years later
 * during an audit.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

/** Every TypeScript file under a directory, excluding generated output. */
const sourceFiles = (dir: string, found: string[] = []): string[] => {
  for (const entry of readdirSync(join(process.cwd(), dir))) {
    const relative = `${dir}/${entry}`;
    const full = join(process.cwd(), relative);
    if (statSync(full).isDirectory()) {
      if (entry !== 'generated' && entry !== 'node_modules') {
        sourceFiles(relative, found);
      }
    } else if (entry.endsWith('.ts')) {
      found.push(relative);
    }
  }
  return found;
};

const readVariables = (): Set<string> => {
  const names = new Set<string>();
  for (const file of [...sourceFiles('src'), ...sourceFiles('scripts')]) {
    const contents = readFileSync(join(process.cwd(), file), 'utf8');
    for (const match of contents.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
      names.add(match[1]!);
    }
  }
  return names;
};

const documentedVariables = (): Set<string> => {
  const contents = readFileSync(join(process.cwd(), '.env.example'), 'utf8');
  return new Set([...contents.matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]!));
};

describe('environment variable documentation', () => {
  it('reads a substantial number of variables', () => {
    expect(readVariables().size).toBeGreaterThan(50);
  });

  it('documents every variable the code reads', () => {
    const documented = documentedVariables();
    const undocumented = [...readVariables()].filter((name) => !documented.has(name)).sort();
    expect(undocumented).toEqual([]);
  });

  /**
   * The reference section is wrapped for readability, so a phrase can span two
   * comment lines. Assertions normalise whitespace rather than depending on
   * where the wrap happens to fall.
   */
  const prose = (): string =>
    readFileSync(join(process.cwd(), '.env.example'), 'utf8').replace(/\s*\n#\s*/g, ' ');

  // These name capabilities that are not wired up. Documenting them without
  // saying so would be worse than silence: an operator would configure them and
  // conclude the system is broken when nothing happened.
  it.each([
    ['the CDN cluster', 'R2_BUCKET', /no-op adapter|permanently off/i],
    ['the governance PDS writer', 'GRAPH_PDS_SIGNING_KEY', /inert|503/i],
    ['the email path', 'SMTP_HOST', /nothing currently invokes/i],
  ])('warns that %s is not active', (_label, variable, warning) => {
    expect(prose()).toContain(variable);
    expect(prose()).toMatch(warning);
  });

  it('warns about the variables that weaken security when set', () => {
    const contents = prose();
    expect(contents).toMatch(/ENABLE_E2E_AUTH_BYPASS/);
    expect(contents).toMatch(/refuses to start/i);
    expect(contents).toMatch(/CHIVE_ALLOW_UNSANDBOXED_PLUGINS/);
    expect(contents).toMatch(/unsandboxed/i);
  });
});
