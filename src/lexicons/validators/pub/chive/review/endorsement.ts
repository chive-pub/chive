/**
 * Zod validator for pub.chive.review.endorsement
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
 * Zod schema for pub.chive.review.endorsement record.
 *
 * @internal
 */
export const reviewEndorsementSchema = z.object({
  eprintUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }),
  contributions: z.array(z.enum(["methodological", "analytical", "theoretical", "empirical", "conceptual", "technical", "data", "replication", "reproducibility", "synthesis", "interdisciplinary", "pedagogical", "visualization", "societal-impact", "clinical"])).min(1).max(15),
  comment: z.string().max(5000).optional(),
  createdAt: z.string().datetime(),
});

/**
 * Type for pub.chive.review.endorsement record.
 *
 * @public
 */
export type ReviewEndorsement = z.infer<typeof reviewEndorsementSchema>;


