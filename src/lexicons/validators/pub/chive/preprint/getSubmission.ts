/**
 * Zod validator for pub.chive.preprint.getSubmission
 *
 * @remarks
 * Generated from Lexicon schema. DO NOT EDIT manually.
 * Regenerate using: pnpm lexicons:generate
 *
 * @packageDocumentation
 * @internal
 */

import { z } from 'zod';
import { preprintSubmissionSchema } from './submission.js';



/**
 * Zod schema for pub.chive.preprint.getSubmission query parameters.
 *
 * @internal
 */
export const preprintGetSubmissionParamsSchema = z.object({
  uri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }),
  cid: z.string().refine((val) => /^[a-z0-9]+$/.test(val) && val.length > 10, { message: "Invalid CID format" }).optional(),
});

/**
 * Zod schema for pub.chive.preprint.getSubmission query output.
 *
 * @internal
 */
export const preprintGetSubmissionOutputSchema = z.object({
  uri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }),
  cid: z.string().refine((val) => /^[a-z0-9]+$/.test(val) && val.length > 10, { message: "Invalid CID format" }),
  value: preprintSubmissionSchema,
  indexedAt: z.string().datetime(),
  pdsUrl: z.string(),
});

/**
 * Type for pub.chive.preprint.getSubmission query parameters.
 *
 * @public
 */
export type PreprintGetSubmissionParams = z.infer<typeof preprintGetSubmissionParamsSchema>;

/**
 * Type for pub.chive.preprint.getSubmission query output.
 *
 * @public
 */
export type PreprintGetSubmissionOutput = z.infer<typeof preprintGetSubmissionOutputSchema>;
