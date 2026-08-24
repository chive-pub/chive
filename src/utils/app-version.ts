/**
 * Resolves the running service's own release version.
 *
 * @remarks
 * Distinct from `./version.js`, which handles semantic versioning of eprint
 * records. This module answers "which Chive release is this process?" and is
 * used by the health endpoints, the logger, and telemetry resources.
 *
 * `process.env.npm_package_version` is only populated when a process is
 * launched through a package script. The production image starts Node directly
 * (`CMD ["node", "--enable-source-maps", "dist/src/index.js"]`), so that
 * variable is unset in every deployed container and the version silently
 * degraded to `0.0.0`. Reading `package.json` relative to the working directory
 * covers both cases: `WORKDIR /app` in the production image, where the builder
 * stage copies `package.json` alongside `dist/`, and the repository root in
 * development.
 *
 * @packageDocumentation
 * @public
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Version reported when the real version cannot be determined.
 *
 * @public
 */
export const UNKNOWN_APP_VERSION = '0.0.0';

let cachedVersion: string | undefined;

/**
 * Reads the `version` field from the working directory's `package.json`.
 *
 * @returns The version string, or undefined if the file is missing, unreadable,
 * malformed, or carries no string `version`
 *
 * @internal
 */
function readVersionFromPackageJson(): string | undefined {
  try {
    const contents = readFileSync(join(process.cwd(), 'package.json'), 'utf8');
    const parsed: unknown = JSON.parse(contents);

    if (typeof parsed !== 'object' || parsed === null || !('version' in parsed)) {
      return undefined;
    }

    const { version } = parsed as { version: unknown };
    return typeof version === 'string' && version.length > 0 ? version : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Returns the release version of the running service.
 *
 * @returns The semantic version string, or `0.0.0` if it cannot be determined
 *
 * @remarks
 * Resolution order: `npm_package_version`, then `package.json` in the working
 * directory, then {@link UNKNOWN_APP_VERSION}. The result is cached, so the
 * file is read at most once per process.
 *
 * @example
 * ```typescript
 * getAppVersion(); // "0.7.0"
 * ```
 *
 * @public
 */
export function getAppVersion(): string {
  cachedVersion ??=
    process.env.npm_package_version ?? readVersionFromPackageJson() ?? UNKNOWN_APP_VERSION;

  return cachedVersion;
}

/**
 * Clears the cached version so the next {@link getAppVersion} call re-resolves.
 *
 * @remarks
 * Exists for tests that need to exercise different resolution paths within a
 * single process. Production code should not call this.
 *
 * @internal
 */
export function resetAppVersionCache(): void {
  cachedVersion = undefined;
}
