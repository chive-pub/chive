#!/usr/bin/env tsx

/**
 * Redis connection verification script.
 *
 * @remarks
 * Verifies Redis is accessible and responds to PING.
 *
 * @packageDocumentation
 */

import Redis from 'ioredis';
import { DatabaseError } from '../../src/types/errors.js';
import { getRedisConfig } from '../../src/storage/redis/structures.js';

async function main(): Promise<void> {
  const config = getRedisConfig();
  const redis = new Redis(config);

  try {
    console.log('Verifying Redis connection...');
    const pong = await redis.ping();

    if (pong !== 'PONG') {
      throw new DatabaseError('QUERY', 'Redis did not respond with PONG');
    }

    console.log('Redis connection verified');
  } catch (error) {
    console.error('Redis verification failed:', error);
    process.exit(1);
  } finally {
    await redis.quit();
  }
}

main();
