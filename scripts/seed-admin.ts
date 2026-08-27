#!/usr/bin/env npx tsx
/**
 * Standalone script to seed admin roles in Redis.
 *
 * Reads ADMIN_DIDS environment variable (comma-separated list of DIDs)
 * and assigns the 'admin' role to each DID via Redis SADD.
 *
 * Usage:
 *   REDIS_URL="redis://localhost:6379" \
 *   ADMIN_DIDS="did:plc:abc123,did:plc:def456" \
 *   pnpm tsx scripts/seed-admin.ts
 */

// ioredis, not node-redis. Thirty modules across the service use ioredis; this
// script was the only thing pulling node-redis in, so it was a second Redis
// client in the production dependency tree for one script's sake.
import { Redis } from 'ioredis';
import { getAdminDids } from '../src/config/admin.js';

const ROLE_PREFIX = 'chive:authz:roles:';
const ASSIGNMENT_PREFIX = 'chive:authz:assignments:';

async function main(): Promise<void> {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  // Resolved through the shared helper so the seeded platform admins and the
  // governance role service can never disagree about who the admins are.
  const adminDids = getAdminDids();

  console.log(`Connecting to Redis at ${redisUrl}...`);
  const redis = new Redis(redisUrl);
  console.log('Connected to Redis.');

  try {
    for (const did of adminDids) {
      const roleKey = `${ROLE_PREFIX}${did}`;
      const assignmentKey = `${ASSIGNMENT_PREFIX}${did}:admin`;

      const added = await redis.sadd(roleKey, 'admin');
      const assignment = JSON.stringify({
        role: 'admin',
        assignedAt: new Date().toISOString(),
        assignedBy: 'seed-admin-script',
      });
      await redis.set(assignmentKey, assignment);

      if (added > 0) {
        console.log(`Assigned admin role to ${did} (new)`);
      } else {
        console.log(`Admin role already exists for ${did} (idempotent)`);
      }
    }

    console.log(`\nSeeded ${adminDids.length} admin DID(s) successfully.`);
  } finally {
    await redis.quit();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
