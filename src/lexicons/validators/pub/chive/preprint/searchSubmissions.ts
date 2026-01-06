/**
 * Zod validator for pub.chive.preprint.searchSubmissions
 *
 * @remarks
 * Generated from Lexicon schema. DO NOT EDIT manually.
 * Regenerate using: pnpm lexicons:generate
 *
 * @packageDocumentation
 * @internal
 */

import { z } from 'zod';



/**
 * Zod schema for pub.chive.preprint.searchSubmissions query parameters.
 *
 * @internal
 */
export const preprintSearchSubmissionsParamsSchema = z.object({
  q: z.string(),
  author: z.string().refine((val) => /^did:[a-z]+:[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid DID format" }).optional(),
  facets: z.array(z.string()).optional(),
  limit: z.number().int().min(1).optional(),
  cursor: z.string().optional(),
});

/**
 * Zod schema for pub.chive.preprint.searchSubmissions query output.
 *
 * @internal
 */
export const preprintSearchSubmissionsOutputSchema = z.object({
  hits: z.array(z.object({ uri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }), score: z.number(), highlight: z.object({ title: z.array(z.string()).optional(), abstract: z.array(z.string()).optional() }).optional() })),
  cursor: z.string().optional(),
  facetAggregations: z.array(z.object({ dimension: z.string(), values: z.array(z.object({ value: z.string(), count: z.number().int() })) })).optional(),
});

/**
 * Type for pub.chive.preprint.searchSubmissions query parameters.
 *
 * @public
 */
export type PreprintSearchSubmissionsParams = z.infer<typeof preprintSearchSubmissionsParamsSchema>;

/**
 * Type for pub.chive.preprint.searchSubmissions query output.
 *
 * @public
 */
export type PreprintSearchSubmissionsOutput = z.infer<typeof preprintSearchSubmissionsOutputSchema>;
