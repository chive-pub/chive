/**
 * Zod validator for pub.chive.eprint.getSubmission
 *
 * @remarks
 * Generated from Lexicon schema. DO NOT EDIT manually.
 * Regenerate using: pnpm lexicons:generate
 *
 * @packageDocumentation
 * @internal
 */

import { z } from 'zod';
import { eprintSubmissionSchema } from './submission.js';



/**
 * Zod schema for pub.chive.eprint.getSubmission query parameters.
 *
 * @internal
 */
export const eprintGetSubmissionParamsSchema = z.object({
  uri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }),
  cid: z.string().refine((val) => /^[a-z0-9]+$/.test(val) && val.length > 10, { message: "Invalid CID format" }).optional(),
});

/**
 * Zod schema for pub.chive.eprint.getSubmission query output.
 *
 * @internal
 */
export const eprintGetSubmissionOutputSchema = z.object({
  uri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }),
  cid: z.string().refine((val) => /^[a-z0-9]+$/.test(val) && val.length > 10, { message: "Invalid CID format" }),
  value: eprintSubmissionSchema,
  indexedAt: z.string().datetime(),
  pdsUrl: z.string(),
});

/**
 * Type for pub.chive.eprint.getSubmission query parameters.
 *
 * @public
 */
export type EprintGetSubmissionParams = z.infer<typeof eprintGetSubmissionParamsSchema>;

/**
 * Type for pub.chive.eprint.getSubmission query output.
 *
 * @public
 */
export type EprintGetSubmissionOutput = z.infer<typeof eprintGetSubmissionOutputSchema>;
