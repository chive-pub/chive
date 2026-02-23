/**
 * Ambient module declarations for third-party packages that lack
 * TypeScript type definitions.
 *
 * @remarks
 * These declarations provide minimal typing so that dynamic imports
 * compile without errors. The actual runtime shapes are validated by
 * the calling code via explicit type assertions.
 */

declare module 'citation-js' {
  interface CslAuthor {
    readonly given?: string;
    readonly family?: string;
  }

  interface CslDate {
    readonly 'date-parts'?: readonly (readonly (number | undefined)[])[];
  }

  interface CslEntry {
    readonly title?: string;
    readonly author?: readonly CslAuthor[];
    readonly issued?: CslDate;
    readonly [key: string]: unknown;
  }

  class Cite {
    constructor(data: string);
    readonly data: readonly CslEntry[];
  }

  export default Cite;
}

declare module '@citation-js/plugin-bibtex' {
  // Side-effect-only import: registers BibTeX parser with citation-js core.
}
