/**
 * OSF (Open Science Framework) integration plugin.
 *
 * @remarks
 * Provides integration with OSF (https://osf.io) for linking preprints
 * to their associated projects, registrations, and files.
 *
 * OSF is a free, open-source platform for supporting research workflow.
 * It provides:
 * - Project management and collaboration
 * - Preprint servers (PsyArXiv, SocArXiv, etc.)
 * - Registrations (pre-registration, registered reports)
 * - File storage and DOI minting
 *
 * Uses OSF API v2:
 * - Base URL: https://api.osf.io/v2
 * - Rate limit: ~100 requests/minute
 *
 * ATProto Compliance:
 * - All data is AppView cache (ephemeral, rebuildable)
 * - Never writes to user PDSes
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import type { IPluginManifest } from '../../types/interfaces/plugin.interface.js';

import { BasePlugin } from './base-plugin.js';

/**
 * OSF project/node metadata.
 *
 * @public
 */
export interface OsfProject {
  /**
   * Project ID.
   */
  id: string;

  /**
   * Project title.
   */
  title: string;

  /**
   * Description.
   */
  description?: string;

  /**
   * Category.
   */
  category: string;

  /**
   * Public visibility.
   */
  public: boolean;

  /**
   * Project URL.
   */
  url: string;

  /**
   * DOI (if minted).
   */
  doi?: string;

  /**
   * Tags.
   */
  tags: readonly string[];

  /**
   * Contributors.
   */
  contributors: readonly {
    id: string;
    fullName: string;
    bibliographic: boolean;
  }[];

  /**
   * License.
   */
  license?: {
    id: string;
    name: string;
  };

  /**
   * Creation date.
   */
  dateCreated: string;

  /**
   * Last modification date.
   */
  dateModified: string;

  /**
   * Whether this is a registration.
   */
  registration: boolean;

  /**
   * Affiliated institutions.
   */
  affiliatedInstitutions: readonly string[];

  /**
   * Source of the metadata.
   */
  source: 'osf';
}

/**
 * OSF registration metadata.
 *
 * @public
 */
export interface OsfRegistration extends OsfProject {
  /**
   * Registration type.
   */
  registrationType: string;

  /**
   * Registration schema.
   */
  registrationSchema?: string;

  /**
   * Registered date.
   */
  dateRegistered: string;

  /**
   * Whether this is a withdrawn registration.
   */
  withdrawn: boolean;

  /**
   * Embargo end date (if embargoed).
   */
  embargoEndDate?: string;
}

/**
 * OSF API node response.
 *
 * @internal
 */
interface OsfApiNode {
  id?: string;
  attributes?: {
    title?: string;
    description?: string;
    category?: string;
    public?: boolean;
    date_created?: string;
    date_modified?: string;
    tags?: string[];
    registration?: boolean;
    withdrawn?: boolean;
    date_registered?: string;
    embargo_end_date?: string;
    registration_supplement?: string;
  };
  relationships?: {
    contributors?: { links?: { related?: { href?: string } } };
    license?: { data?: { id?: string; type?: string } };
    affiliated_institutions?: { data?: { id?: string }[] };
  };
  links?: {
    html?: string;
    self?: string;
  };
}

/**
 * OSF API contributor response.
 *
 * @internal
 */
interface OsfApiContributor {
  id?: string;
  embeds?: {
    users?: {
      data?: {
        id?: string;
        attributes?: {
          full_name?: string;
        };
      };
    };
  };
  attributes?: {
    bibliographic?: boolean;
  };
}

/**
 * OSF API search response.
 *
 * @internal
 */
interface OsfSearchResponse {
  data: OsfApiNode[];
  links?: {
    next?: string;
  };
  meta?: {
    total?: number;
  };
}

/**
 * OSF integration plugin.
 *
 * @remarks
 * Provides project and registration lookup for linking preprints to OSF projects.
 * Supports finding pre-registrations, registered reports, and data repositories.
 *
 * @example
 * ```typescript
 * const plugin = new OsfPlugin();
 * await manager.loadBuiltinPlugin(plugin);
 *
 * // Get project by ID
 * const project = await plugin.getProject('abcde');
 *
 * // Search for registrations
 * const regs = await plugin.searchRegistrations('pre-registration');
 * ```
 *
 * @public
 */
export class OsfPlugin extends BasePlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.osf';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.osf',
    name: 'OSF Integration',
    version: '0.1.0',
    description: 'Provides project and registration linking via OSF',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      network: {
        allowedDomains: ['api.osf.io', 'osf.io'],
      },
      storage: {
        maxSize: 50 * 1024 * 1024, // 50MB
      },
    },
    entrypoint: 'osf.js',
  };

  /**
   * OSF API base URL.
   */
  private readonly API_BASE_URL = 'https://api.osf.io/v2';

  /**
   * Cache TTL in seconds (1 day).
   */
  private readonly CACHE_TTL = 86400;

  /**
   * Minimum delay between requests (ms).
   */
  protected rateLimitDelayMs = 600;

  /**
   * Last request timestamp.
   */
  private lastRequestTime = 0;

  /**
   * Initializes the plugin.
   */
  protected onInitialize(): Promise<void> {
    this.logger.info('OSF plugin initialized', {
      rateLimit: `${this.rateLimitDelayMs}ms between requests`,
    });

    return Promise.resolve();
  }

  /**
   * Enforces rate limiting.
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.rateLimitDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.rateLimitDelayMs - elapsed));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Gets project by ID.
   *
   * @param projectId - OSF project/node ID
   * @returns Project metadata or null
   *
   * @public
   */
  async getProject(projectId: string): Promise<OsfProject | null> {
    const cacheKey = `osf:node:${projectId}`;
    const cached = await this.cache.get<OsfProject>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    try {
      const response = await fetch(`${this.API_BASE_URL}/nodes/${projectId}/`, {
        headers: {
          Accept: 'application/vnd.api+json',
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        this.logger.warn('OSF API error', {
          projectId,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as { data: OsfApiNode };

      // Fetch contributors
      const contributors = await this.fetchContributors(projectId);

      const project = this.parseNode(data.data, contributors);

      if (project) {
        await this.cache.set(cacheKey, project, this.CACHE_TTL);
      }

      return project;
    } catch (err) {
      this.logger.warn('Error fetching OSF project', {
        projectId,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Gets registration by ID.
   *
   * @param registrationId - OSF registration ID
   * @returns Registration metadata or null
   *
   * @public
   */
  async getRegistration(registrationId: string): Promise<OsfRegistration | null> {
    const cacheKey = `osf:registration:${registrationId}`;
    const cached = await this.cache.get<OsfRegistration>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    try {
      const response = await fetch(`${this.API_BASE_URL}/registrations/${registrationId}/`, {
        headers: {
          Accept: 'application/vnd.api+json',
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        this.logger.warn('OSF API error', {
          registrationId,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as { data: OsfApiNode };

      // Fetch contributors
      const contributors = await this.fetchRegistrationContributors(registrationId);

      const registration = this.parseRegistration(data.data, contributors);

      if (registration) {
        await this.cache.set(cacheKey, registration, this.CACHE_TTL);
      }

      return registration;
    } catch (err) {
      this.logger.warn('Error fetching OSF registration', {
        registrationId,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Searches for projects.
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Matching projects
   *
   * @public
   */
  async searchProjects(
    query: string,
    options?: { limit?: number }
  ): Promise<readonly OsfProject[]> {
    await this.rateLimit();

    const limit = Math.min(options?.limit ?? 10, 100);

    try {
      const params = new URLSearchParams({
        'filter[title]': query,
        'filter[public]': 'true',
        'page[size]': limit.toString(),
      });

      const response = await fetch(`${this.API_BASE_URL}/nodes/?${params.toString()}`, {
        headers: {
          Accept: 'application/vnd.api+json',
        },
      });

      if (!response.ok) {
        this.logger.warn('OSF search error', {
          query,
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as OsfSearchResponse;
      const projects: OsfProject[] = [];

      for (const node of data.data) {
        const project = this.parseNode(node, []);
        if (project) {
          projects.push(project);
        }
      }

      return projects;
    } catch (err) {
      this.logger.warn('Error searching OSF', {
        query,
        error: (err as Error).message,
      });
      return [];
    }
  }

  /**
   * Searches for registrations.
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Matching registrations
   *
   * @public
   */
  async searchRegistrations(
    query: string,
    options?: { limit?: number }
  ): Promise<readonly OsfRegistration[]> {
    await this.rateLimit();

    const limit = Math.min(options?.limit ?? 10, 100);

    try {
      const params = new URLSearchParams({
        'filter[title]': query,
        'filter[public]': 'true',
        'page[size]': limit.toString(),
      });

      const response = await fetch(`${this.API_BASE_URL}/registrations/?${params.toString()}`, {
        headers: {
          Accept: 'application/vnd.api+json',
        },
      });

      if (!response.ok) {
        this.logger.warn('OSF registration search error', {
          query,
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as OsfSearchResponse;
      const registrations: OsfRegistration[] = [];

      for (const node of data.data) {
        const registration = this.parseRegistration(node, []);
        if (registration) {
          registrations.push(registration);
        }
      }

      return registrations;
    } catch (err) {
      this.logger.warn('Error searching OSF registrations', {
        query,
        error: (err as Error).message,
      });
      return [];
    }
  }

  /**
   * Parses OSF URL to extract ID.
   *
   * @param url - OSF URL
   * @returns Project/registration ID or null
   *
   * @public
   */
  parseOsfUrl(url: string): { type: 'node' | 'registration'; id: string } | null {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.endsWith('osf.io')) {
        return null;
      }

      // Match /abcde or /registrations/abcde
      const nodeMatch = /^\/([a-z0-9]{5})\/?$/i.exec(parsed.pathname);
      if (nodeMatch?.[1]) {
        return { type: 'node', id: nodeMatch[1] };
      }

      const regMatch = /^\/registrations\/([a-z0-9]{5})\/?$/i.exec(parsed.pathname);
      if (regMatch?.[1]) {
        return { type: 'registration', id: regMatch[1] };
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Fetches contributors for a project.
   */
  private async fetchContributors(projectId: string): Promise<OsfApiContributor[]> {
    await this.rateLimit();

    try {
      const response = await fetch(
        `${this.API_BASE_URL}/nodes/${projectId}/contributors/?embed=users`,
        {
          headers: {
            Accept: 'application/vnd.api+json',
          },
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as { data: OsfApiContributor[] };
      return data.data;
    } catch {
      return [];
    }
  }

  /**
   * Fetches contributors for a registration.
   */
  private async fetchRegistrationContributors(
    registrationId: string
  ): Promise<OsfApiContributor[]> {
    await this.rateLimit();

    try {
      const response = await fetch(
        `${this.API_BASE_URL}/registrations/${registrationId}/contributors/?embed=users`,
        {
          headers: {
            Accept: 'application/vnd.api+json',
          },
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as { data: OsfApiContributor[] };
      return data.data;
    } catch {
      return [];
    }
  }

  /**
   * Parses API node to OsfProject.
   */
  private parseNode(data: OsfApiNode, contributors: OsfApiContributor[]): OsfProject | null {
    if (!data.id || !data.attributes?.title) {
      return null;
    }

    const attrs = data.attributes;

    return {
      id: data.id,
      title: attrs.title ?? 'Untitled',
      description: attrs.description,
      category: attrs.category ?? 'project',
      public: attrs.public ?? false,
      url: data.links?.html ?? `https://osf.io/${data.id}`,
      tags: attrs.tags ?? [],
      contributors: contributors.map((c) => ({
        id: c.embeds?.users?.data?.id ?? c.id ?? '',
        fullName: c.embeds?.users?.data?.attributes?.full_name ?? 'Unknown',
        bibliographic: c.attributes?.bibliographic ?? true,
      })),
      license: data.relationships?.license?.data?.id
        ? { id: data.relationships.license.data.id, name: data.relationships.license.data.id }
        : undefined,
      dateCreated: attrs.date_created ?? '',
      dateModified: attrs.date_modified ?? '',
      registration: attrs.registration ?? false,
      affiliatedInstitutions:
        data.relationships?.affiliated_institutions?.data?.map((i) => i.id ?? '') ?? [],
      source: 'osf',
    };
  }

  /**
   * Parses API node to OsfRegistration.
   */
  private parseRegistration(
    data: OsfApiNode,
    contributors: OsfApiContributor[]
  ): OsfRegistration | null {
    const base = this.parseNode(data, contributors);
    if (!base) {
      return null;
    }

    const attrs = data.attributes;

    return {
      ...base,
      registration: true,
      registrationType: attrs?.registration_supplement ?? 'Unknown',
      dateRegistered: attrs?.date_registered ?? base.dateCreated,
      withdrawn: attrs?.withdrawn ?? false,
      embargoEndDate: attrs?.embargo_end_date,
    };
  }
}

export default OsfPlugin;
