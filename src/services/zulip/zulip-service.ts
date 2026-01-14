/**
 * Zulip service for managing Zulip users.
 *
 * @remarks
 * Uses Zulip's Admin API for user creation and management.
 * Requires a bot with admin privileges.
 *
 * @packageDocumentation
 * @public
 */

import crypto from 'crypto';

import { ZulipError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Zulip user representation.
 */
export interface ZulipUser {
  readonly userId: number;
  readonly email: string;
  readonly fullName: string;
  readonly isActive: boolean;
}

/**
 * Zulip service configuration.
 */
export interface ZulipServiceConfig {
  readonly serverUrl: string;
  readonly botEmail: string;
  readonly botApiKey: string;
}

/**
 * Zulip service options.
 */
export interface ZulipServiceOptions {
  readonly config: ZulipServiceConfig;
  readonly logger: ILogger;
}

/**
 * Create user options.
 */
export interface CreateUserOptions {
  readonly email: string;
  readonly fullName: string;
}

/**
 * Zulip service interface.
 */
export interface IZulipService {
  /**
   * Create a new Zulip user.
   *
   * @param options - User creation options
   * @returns Created user
   */
  createUser(options: CreateUserOptions): Promise<ZulipUser>;

  /**
   * Check if a user exists by email.
   *
   * @param email - User email
   * @returns true if user exists
   */
  userExists(email: string): Promise<boolean>;

  /**
   * Deactivate a user.
   *
   * @param userId - User ID to deactivate
   */
  deactivateUser(userId: number): Promise<void>;
}

/**
 * Zulip service implementation.
 *
 * @public
 */
export class ZulipService implements IZulipService {
  private readonly config: ZulipServiceConfig;
  private readonly logger: ILogger;
  private readonly authHeader: string;

  constructor(options: ZulipServiceOptions) {
    this.config = options.config;
    this.logger = options.logger;

    // Create Basic auth header
    const credentials = `${this.config.botEmail}:${this.config.botApiKey}`;
    this.authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`;
  }

  /**
   * Create a new Zulip user.
   *
   * @param options - User creation options
   * @returns Created user
   * @throws ZulipError if creation fails
   */
  async createUser(options: CreateUserOptions): Promise<ZulipUser> {
    const { email, fullName } = options;

    // Generate a random password (user can reset via email)
    const password = this.generatePassword();

    const url = `${this.config.serverUrl}/api/v1/users`;
    const body = new URLSearchParams({
      email,
      password,
      full_name: fullName,
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = (await response.json()) as {
        result: string;
        msg: string;
        user_id?: number;
      };

      if (!response.ok || data.result !== 'success') {
        // Check if user already exists
        if (data.msg?.includes('already exists')) {
          this.logger.info('Zulip user already exists', { email });
          // Try to get existing user
          const existingUser = await this.getUserByEmail(email);
          if (existingUser) {
            return existingUser;
          }
        }

        throw new ZulipError(`Failed to create Zulip user: ${data.msg}`, response.status, email);
      }

      const userId = data.user_id;
      if (userId === undefined) {
        throw new ZulipError('Zulip API did not return user_id', response.status, email);
      }

      this.logger.info('Zulip user created', { email, userId });

      return {
        userId,
        email,
        fullName,
        isActive: true,
      };
    } catch (error) {
      if (error instanceof ZulipError) {
        throw error;
      }
      this.logger.error('Failed to create Zulip user', error instanceof Error ? error : undefined);
      throw new ZulipError(
        'Failed to create Zulip user',
        undefined,
        email,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if a user exists by email.
   *
   * @param email - User email
   * @returns true if user exists
   */
  async userExists(email: string): Promise<boolean> {
    const user = await this.getUserByEmail(email);
    return user !== null;
  }

  /**
   * Get a user by email.
   *
   * @param email - User email
   * @returns User or null if not found
   */
  async getUserByEmail(email: string): Promise<ZulipUser | null> {
    const url = `${this.config.serverUrl}/api/v1/users/${encodeURIComponent(email)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: this.authHeader,
        },
      });

      if (response.status === 404) {
        return null;
      }

      const data = (await response.json()) as {
        result: string;
        user?: {
          user_id: number;
          email: string;
          full_name: string;
          is_active: boolean;
        };
      };

      if (data.result !== 'success' || !data.user) {
        return null;
      }

      return {
        userId: data.user.user_id,
        email: data.user.email,
        fullName: data.user.full_name,
        isActive: data.user.is_active,
      };
    } catch (error) {
      this.logger.error('Failed to get Zulip user', error instanceof Error ? error : undefined);
      return null;
    }
  }

  /**
   * Deactivate a user.
   *
   * @param userId - User ID to deactivate
   * @throws ZulipError if deactivation fails
   */
  async deactivateUser(userId: number): Promise<void> {
    const url = `${this.config.serverUrl}/api/v1/users/${userId}`;

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: this.authHeader,
        },
      });

      const data = (await response.json()) as { result: string; msg: string };

      if (!response.ok || data.result !== 'success') {
        throw new ZulipError(`Failed to deactivate Zulip user: ${data.msg}`, response.status);
      }

      this.logger.info('Zulip user deactivated', { userId });
    } catch (error) {
      if (error instanceof ZulipError) {
        throw error;
      }
      this.logger.error(
        'Failed to deactivate Zulip user',
        error instanceof Error ? error : undefined
      );
      throw new ZulipError(
        'Failed to deactivate Zulip user',
        undefined,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generate a random password.
   */
  private generatePassword(): string {
    return crypto.randomBytes(16).toString('base64url');
  }
}

/**
 * Create Zulip service from environment variables.
 *
 * @param logger - Logger instance
 * @returns Zulip service or null if not configured
 */
export function createZulipServiceFromEnv(logger: ILogger): ZulipService | null {
  const serverUrl = process.env.ZULIP_SERVER_URL;
  const botEmail = process.env.ZULIP_BOT_EMAIL;
  const botApiKey = process.env.ZULIP_BOT_API_KEY;

  if (!serverUrl || !botEmail || !botApiKey) {
    logger.warn('Zulip service not configured: missing environment variables');
    return null;
  }

  return new ZulipService({
    config: {
      serverUrl,
      botEmail,
      botApiKey,
    },
    logger,
  });
}
