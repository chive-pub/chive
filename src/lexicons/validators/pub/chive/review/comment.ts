/**
 * Zod validator for pub.chive.review.comment
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
 * Zod schema for pub.chive.review.comment record.
 *
 * @internal
 */
export const reviewCommentSchema = z.object({
  preprintUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }),
  content: z.string().max(10000),
  lineNumber: z.number().int().min(1).optional(),
  parentComment: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }).optional(),
  createdAt: z.string().datetime(),
});

/**
 * Type for pub.chive.review.comment record.
 *
 * @public
 */
export type ReviewComment = z.infer<typeof reviewCommentSchema>;


