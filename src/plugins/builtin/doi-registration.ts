/**
 * DOI registration plugin via DataCite.
 *
 * @remarks
 * Mints DOIs for eprints using the DataCite REST API.
 *
 * ATProto Compliance Note:
 * - DOI registration is a SIDE EFFECT, not data storage
 * - The DOI is stored by DataCite, not by Chive
 * - Eprint records reference DOIs via metadata
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import { PluginError } from '../../types/errors.js';
import type { IPluginManifest } from '../../types/interfaces/plugin.interface.js';

import { BasePlugin } from './base-plugin.js';

/**
 * DOI metadata returned after registration.
 *
 * @public
 */
export interface DoiMetadata {
  /**
   * The registered DOI (e.g., 10.5072/chive.abc123).
   */
  doi: string;

  /**
   * URL the DOI resolves to.
   */
  url: string;

  /**
   * Registration timestamp.
   */
  registered: string;

  /**
   * DOI state (draft, registered, findable).
   */
  state: 'draft' | 'registered' | 'findable';
}

/**
 * Author information for DOI metadata.
 *
 * @public
 */
export interface DoiAuthor {
  /**
   * Author name.
   */
  name: string;

  /**
   * ORCID identifier (optional).
   */
  orcid?: string;
}

/**
 * Eprint indexed event data.
 *
 * @internal
 */
interface EprintIndexedEvent {
  uri: string;
  title: string;
  authors: readonly DoiAuthor[];
  abstract?: string;
  requestDoi?: boolean;
}

/**
 * DataCite API response structure.
 *
 * @internal
 */
interface DataCiteResponse {
  data: {
    id: string;
    attributes: {
      url: string;
      registered?: string;
      state: 'draft' | 'registered' | 'findable';
    };
  };
}

/**
 * DOI registration plugin.
 *
 * @remarks
 * Mints DOIs for eprints via DataCite when requested.
 * Requires DataCite credentials configured in plugin config.
 *
 * @example
 * ```typescript
 * const plugin = new DoiRegistrationPlugin();
 * await manager.loadBuiltinPlugin(plugin, {
 *   dataciteApiUrl: 'https://api.datacite.org',
 *   datacitePrefix: '10.5072', // Test prefix
 *   dataciteRepositoryId: 'xxx',
 *   datacitePassword: 'xxx',
 * });
 * ```
 *
 * @public
 */
export class DoiRegistrationPlugin extends BasePlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.doi';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.doi',
    name: 'DOI Registration',
    version: '0.1.0',
    description: 'Mints DOIs for eprints via DataCite',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      network: {
        allowedDomains: ['api.datacite.org', 'api.test.datacite.org'],
      },
      hooks: ['eprint.indexed'],
      storage: {
        maxSize: 1 * 1024 * 1024, // 1MB
      },
    },
    entrypoint: 'doi-registration.js',
  };

  /**
   * DataCite API URL.
   */
  private dataciteApiUrl!: string;

  /**
   * DOI prefix (e.g., 10.5072 for test).
   */
  private datacitePrefix!: string;

  /**
   * Base64 encoded credentials.
   */
  private dataciteCredentials?: string;

  /**
   * Whether plugin is properly configured.
   */
  private isConfigured = false;

  /**
   * Initializes the plugin.
   */
  protected onInitialize(): Promise<void> {
    // Load configuration
    this.dataciteApiUrl =
      this.getConfig<string>('dataciteApiUrl') ?? 'https://api.test.datacite.org';
    this.datacitePrefix = this.getConfig<string>('datacitePrefix') ?? '10.5072';

    const repositoryId = this.getConfig<string>('dataciteRepositoryId');
    const password = this.getConfig<string>('datacitePassword');

    if (repositoryId && password) {
      this.dataciteCredentials = Buffer.from(`${repositoryId}:${password}`).toString('base64');
      this.isConfigured = true;
      this.logger.info('DOI registration configured', {
        apiUrl: this.dataciteApiUrl,
        prefix: this.datacitePrefix,
      });
    } else {
      this.logger.warn('DOI registration not configured - credentials missing');
    }

    this.context.eventBus.on('eprint.indexed', (...args: readonly unknown[]) => {
      void this.handleEprintIndexed(args[0] as EprintIndexedEvent);
    });

    return Promise.resolve();
  }

  /**
   * Handles eprint indexed events.
   */
  private async handleEprintIndexed(data: EprintIndexedEvent): Promise<void> {
    if (!data.requestDoi) {
      return;
    }

    if (!this.isConfigured) {
      this.logger.warn('Cannot mint DOI - plugin not configured');
      return;
    }

    try {
      const doi = await this.mintDoi(data);

      this.logger.info('DOI minted', {
        eprintUri: data.uri,
        doi: doi.doi,
        state: doi.state,
      });

      this.recordCounter('dois_minted');

      // Emit DOI minted event
      this.context.eventBus.emit('doi.minted', {
        eprintUri: data.uri,
        doi: doi.doi,
        url: doi.url,
      });
    } catch (err) {
      this.logger.error('Failed to mint DOI', err as Error, {
        eprintUri: data.uri,
      });

      this.recordCounter('mint_errors');
    }
  }

  /**
   * Mints a DOI for an eprint.
   *
   * @param data - Eprint data
   * @returns DOI metadata
   *
   * @public
   */
  async mintDoi(data: {
    uri: string;
    title: string;
    authors: readonly DoiAuthor[];
    abstract?: string;
  }): Promise<DoiMetadata> {
    if (!this.dataciteCredentials) {
      throw new PluginError(this.id, 'EXECUTE', 'DataCite credentials not configured');
    }

    const suffix = this.generateSuffix(data.uri);
    const doi = `${this.datacitePrefix}/${suffix}`;
    const url = `https://chive.pub/eprint/${encodeURIComponent(data.uri)}`;

    // Build DataCite metadata
    const payload = {
      data: {
        type: 'dois',
        attributes: {
          doi,
          event: 'publish',
          creators: data.authors.map((author) => ({
            name: author.name,
            nameIdentifiers: author.orcid
              ? [
                  {
                    nameIdentifier: `https://orcid.org/${author.orcid}`,
                    nameIdentifierScheme: 'ORCID',
                    schemeUri: 'https://orcid.org',
                  },
                ]
              : [],
          })),
          titles: [{ title: data.title }],
          publisher: 'Chive Eprint Server',
          publicationYear: new Date().getFullYear(),
          types: {
            resourceTypeGeneral: 'Eprint',
            resourceType: 'Eprint',
          },
          url,
          descriptions: data.abstract
            ? [{ description: data.abstract, descriptionType: 'Abstract' }]
            : [],
          schemaVersion: 'http://datacite.org/schema/kernel-4',
        },
      },
    };

    const response = await fetch(`${this.dataciteApiUrl}/dois`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Basic ${this.dataciteCredentials}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new PluginError(
        this.id,
        'EXECUTE',
        `DataCite API error: ${response.status} - ${error}`
      );
    }

    const result = (await response.json()) as DataCiteResponse;

    const metadata: DoiMetadata = {
      doi: result.data.id,
      url: result.data.attributes.url,
      registered: result.data.attributes.registered ?? new Date().toISOString(),
      state: result.data.attributes.state,
    };

    // Cache the DOI metadata
    await this.cache.set(`doi:${data.uri}`, metadata);

    return metadata;
  }

  /**
   * Gets DOI for an eprint if already minted.
   *
   * @param eprintUri - Eprint AT URI
   * @returns DOI metadata or null
   *
   * @public
   */
  async getDoi(eprintUri: string): Promise<DoiMetadata | null> {
    return this.cache.get<DoiMetadata>(`doi:${eprintUri}`);
  }

  /**
   * Generates a deterministic DOI suffix from the AT URI.
   *
   * @param uri - AT URI
   * @returns DOI suffix
   */
  private generateSuffix(uri: string): string {
    // Extract rkey from AT URI
    const parts = uri.split('/');
    const rkey = parts[parts.length - 1] ?? '';

    // Use rkey as suffix (already unique per eprint)
    return `chive.${rkey}`;
  }
}

export default DoiRegistrationPlugin;
