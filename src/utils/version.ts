/**
 * Semantic versioning utilities for eprint versioning.
 *
 * @remarks
 * Provides helpers for working with semantic versions following MAJOR.MINOR.PATCH format.
 *
 * **Version Semantics for Eprints:**
 * - Major (X.0.0): Fundamental revision, retracted & replaced, major corrections
 * - Minor (1.X.0): New content, significant additions, new analysis
 * - Patch (1.0.X): Typo fixes, formatting, citation corrections
 * - Prerelease: Work in progress (e.g., draft, rc1)
 *
 * @packageDocumentation
 * @public
 */

/**
 * Semantic version object.
 *
 * @public
 */
export interface SemanticVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease?: string;
}

/**
 * Version bump type for semantic versioning.
 *
 * @public
 */
export type VersionBumpType = 'major' | 'minor' | 'patch';

/**
 * Creates a new SemanticVersion with default values.
 *
 * @param overrides - Optional overrides for version components
 * @returns New SemanticVersion object
 *
 * @example
 * ```typescript
 * const v1 = createVersion(); // { major: 1, minor: 0, patch: 0 }
 * const v2 = createVersion({ prerelease: 'draft' }); // { major: 1, minor: 0, patch: 0, prerelease: 'draft' }
 * ```
 *
 * @public
 */
export function createVersion(overrides?: Partial<SemanticVersion>): SemanticVersion {
  return {
    major: overrides?.major ?? 1,
    minor: overrides?.minor ?? 0,
    patch: overrides?.patch ?? 0,
    prerelease: overrides?.prerelease,
  };
}

/**
 * Bumps a semantic version based on the bump type.
 *
 * @param current - Current semantic version (defaults to 1.0.0 if undefined)
 * @param bumpType - Type of version bump
 * @returns New semantic version with incremented component
 *
 * @remarks
 * When bumping:
 * - Major: Increments major, resets minor and patch to 0
 * - Minor: Increments minor, resets patch to 0
 * - Patch: Increments patch only
 *
 * Prerelease identifier is always cleared when bumping.
 *
 * @example
 * ```typescript
 * const v1 = { major: 1, minor: 2, patch: 3 };
 * bumpVersion(v1, 'major'); // { major: 2, minor: 0, patch: 0 }
 * bumpVersion(v1, 'minor'); // { major: 1, minor: 3, patch: 0 }
 * bumpVersion(v1, 'patch'); // { major: 1, minor: 2, patch: 4 }
 * ```
 *
 * @public
 */
export function bumpVersion(
  current: SemanticVersion | undefined,
  bumpType: VersionBumpType
): SemanticVersion {
  const base: SemanticVersion = current ?? { major: 1, minor: 0, patch: 0 };

  switch (bumpType) {
    case 'major':
      return { major: base.major + 1, minor: 0, patch: 0 };
    case 'minor':
      return { major: base.major, minor: base.minor + 1, patch: 0 };
    case 'patch':
      return { major: base.major, minor: base.minor, patch: base.patch + 1 };
    default:
      return base;
  }
}

/**
 * Formats a semantic version as a string.
 *
 * @param version - Semantic version to format
 * @returns Formatted version string (e.g., "1.2.3" or "1.2.3-draft")
 *
 * @example
 * ```typescript
 * formatVersion({ major: 1, minor: 2, patch: 3 }); // "1.2.3"
 * formatVersion({ major: 1, minor: 0, patch: 0, prerelease: 'draft' }); // "1.0.0-draft"
 * ```
 *
 * @public
 */
export function formatVersion(version: SemanticVersion): string {
  const base = `${version.major}.${version.minor}.${version.patch}`;
  return version.prerelease ? `${base}-${version.prerelease}` : base;
}

/**
 * Parses a version string into a SemanticVersion object.
 *
 * @param versionString - Version string to parse (e.g., "1.2.3" or "1.2.3-draft")
 * @returns SemanticVersion object or null if invalid
 *
 * @example
 * ```typescript
 * parseVersion("1.2.3"); // { major: 1, minor: 2, patch: 3 }
 * parseVersion("1.0.0-draft"); // { major: 1, minor: 0, patch: 0, prerelease: 'draft' }
 * parseVersion("invalid"); // null
 * ```
 *
 * @public
 */
export function parseVersion(versionString: string): SemanticVersion | null {
  const regex = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9]+))?$/;
  const match = regex.exec(versionString);

  if (!match) {
    return null;
  }

  const [, majorStr, minorStr, patchStr, prerelease] = match;

  if (!majorStr || !minorStr || !patchStr) {
    return null;
  }

  return {
    major: parseInt(majorStr, 10),
    minor: parseInt(minorStr, 10),
    patch: parseInt(patchStr, 10),
    prerelease,
  };
}

/**
 * Compares two semantic versions.
 *
 * @param a - First version
 * @param b - Second version
 * @returns Negative if a < b, positive if a > b, zero if equal
 *
 * @remarks
 * Prerelease versions are considered less than release versions.
 * For example, 1.0.0-draft < 1.0.0.
 *
 * @example
 * ```typescript
 * compareVersions({ major: 1, minor: 0, patch: 0 }, { major: 2, minor: 0, patch: 0 }); // -1
 * compareVersions({ major: 2, minor: 0, patch: 0 }, { major: 1, minor: 0, patch: 0 }); // 1
 * compareVersions({ major: 1, minor: 0, patch: 0 }, { major: 1, minor: 0, patch: 0 }); // 0
 * ```
 *
 * @public
 */
export function compareVersions(a: SemanticVersion, b: SemanticVersion): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;

  // Prerelease vs release: prerelease is less than release
  if (a.prerelease && !b.prerelease) return -1;
  if (!a.prerelease && b.prerelease) return 1;

  // Both have prerelease: compare alphabetically
  if (a.prerelease && b.prerelease) {
    return a.prerelease.localeCompare(b.prerelease);
  }

  return 0;
}

/**
 * Converts an integer version to semantic version.
 *
 * @param version - integer version number (1-indexed)
 * @returns SemanticVersion with major set to the integer value
 *
 * @remarks
 * The integer is treated as the major version component.
 *
 * @example
 * ```typescript
 * integerToSemantic(3); // { major: 3, minor: 0, patch: 0 }
 * ```
 *
 * @public
 */
export function integerToSemantic(version: number): SemanticVersion {
  return { major: version, minor: 0, patch: 0 };
}
