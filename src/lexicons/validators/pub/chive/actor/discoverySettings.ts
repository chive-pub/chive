/**
 * Zod validator for pub.chive.actor.discoverySettings
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
 * Zod schema for pub.chive.actor.discoverySettings record.
 *
 * @internal
 */
export const actorDiscoverySettingsSchema = z.object({
  enablePersonalization: z.boolean().optional(),
  enableForYouFeed: z.boolean().optional(),
  forYouSignals: z.object({ fields: z.boolean().optional(), citations: z.boolean().optional(), collaborators: z.boolean().optional(), trending: z.boolean().optional() }).optional(),
  relatedPapersSignals: z.object({ citations: z.boolean().optional(), topics: z.boolean().optional() }).optional(),
  citationNetworkDisplay: z.enum(["hidden", "preview", "expanded"]).optional(),
  showRecommendationReasons: z.boolean().optional(),
});

/**
 * Type for pub.chive.actor.discoverySettings record.
 *
 * @public
 */
export type ActorDiscoverySettings = z.infer<typeof actorDiscoverySettingsSchema>;


