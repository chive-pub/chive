/**
 * Every script the deploy runs must install the reflect polyfill itself.
 *
 * @remarks
 * tsyringe reads `Reflect.getMetadata` when its module loads and throws
 * outright without `reflect-metadata`. The server entry points import it, so
 * anything reached through them is fine — but the deploy runs these scripts as
 * their own `node dist/...` processes, where nothing else installs it.
 *
 * A unit test cannot catch this on its own: vitest's setup loads the polyfill
 * for the whole run, so the script under test imports cleanly here and fails
 * only in the compiled deploy. Hence a check on the source text rather than on
 * behaviour. It reads the workflow so the list cannot drift from what the
 * deploy actually executes.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const workflow = readFileSync(join(root, '.github/workflows/deploy-app.yml'), 'utf8');

/**
 * The scripts `deploy-app.yml` invokes as their own node processes.
 */
function deployScripts(): string[] {
  const found = workflow.matchAll(/node[^\n]*\s(dist\/scripts\/[\w/-]+)\.js/g);
  return [...new Set([...found].map((m) => `${m[1]!.replace(/^dist\//, '')}.ts`))];
}

describe('scripts run directly by the deploy', () => {
  const scripts = deployScripts();

  it('finds the scripts the workflow runs', () => {
    expect(scripts.length).toBeGreaterThan(0);
  });

  it.each(scripts)('%s imports reflect-metadata', (relative) => {
    const source = readFileSync(join(root, relative), 'utf8');

    // Not every one of these reaches the container today. The requirement is
    // unconditional anyway: the import is idempotent and costs a line, whereas
    // deciding per script whether some transitive import happens to use DI is a
    // judgement that only announces itself by breaking a deploy.
    expect(source).toMatch(/^import ['"]reflect-metadata['"];$/m);
  });
});
