/**
 * Shared syntax highlighting configuration using lowlight/highlight.js.
 *
 * @remarks
 * Provides a pre-configured lowlight instance for use by TipTap's
 * CodeBlockLowlight extension and standalone renderers.
 *
 * @packageDocumentation
 */

import { all, createLowlight } from 'lowlight';

/**
 * Shared lowlight instance configured with all languages.
 *
 * @remarks
 * Uses the `all` set (~190 languages) to match GitHub's language
 * coverage. This is powered by highlight.js under the hood.
 */
export const lowlight = createLowlight(all);
