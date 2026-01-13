/**
 * Zod validator for pub.chive.eprint.userTag
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
 * Zod schema for pub.chive.eprint.userTag record.
 *
 * @internal
 */
export const eprintUserTagSchema = z.object({
  eprintUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }),
  tag: z.string().max(100),
  createdAt: z.string().datetime(),
});

/**
 * Type for pub.chive.eprint.userTag record.
 *
 * @public
 */
export type EprintUserTag = z.infer<typeof eprintUserTagSchema>;


