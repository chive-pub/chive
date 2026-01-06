/**
 * Zod validator for pub.chive.review.entityLink
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
 * Zod schema for pub.chive.review.entityLink record.
 *
 * @internal
 */
export const reviewEntityLinkSchema = z.object({
  preprintUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }),
  target: z.object({ source: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }), selector: z.object({ type: z.string(), exact: z.string(), prefix: z.string().max(32).optional(), suffix: z.string().max(32).optional() }), refinedBy: z.object({ type: z.string(), start: z.number().int().min(0), end: z.number().int().min(0), pageNumber: z.number().int().min(1) }).optional() }),
  linkedEntity: z.union([z.object({ type: z.string(), qid: z.string(), label: z.string(), url: z.string().optional() }), z.object({ type: z.string(), uri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }), label: z.string() }), z.object({ type: z.string(), uri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }), label: z.string() }), z.object({ type: z.string(), did: z.string().refine((val) => /^did:[a-z]+:[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid DID format" }), displayName: z.string(), orcid: z.string().optional() }), z.object({ type: z.string(), uri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }), title: z.string() })]),
  confidence: z.number().optional(),
  createdAt: z.string().datetime(),
});

/**
 * Type for pub.chive.review.entityLink record.
 *
 * @public
 */
export type ReviewEntityLink = z.infer<typeof reviewEntityLinkSchema>;


