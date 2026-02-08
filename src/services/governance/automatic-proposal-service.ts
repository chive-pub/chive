/**
 * Automatic governance proposal service.
 *
 * @remarks
 * Creates governance proposals automatically when certain events occur:
 * - Author proposals: on first eprint submission (only for authors with ATProto identities)
 * - Eprint proposals: immediately upon submission to Chive
 * - Institution proposals: on eprint submission when authors have affiliations, and on profile updates
 *
 * Proposals are created in the Graph PDS as system-generated proposals.
 *
 * @packageDocumentation
 */

import type { Pool } from 'pg';
import { singleton } from 'tsyringe';

import { nodeUuid } from '../../../scripts/db/lib/deterministic-uuid.js';
import type { AtUri, DID, NSID } from '../../types/atproto.js';
import type { IGraphDatabase } from '../../types/interfaces/graph.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { EprintAuthor } from '../../types/models/author.js';
import type { Eprint } from '../../types/models/eprint.js';
import { extractPlainText } from '../../utils/rich-text.js';

import { GovernancePDSWriter } from './governance-pds-writer.js';

/**
 * Options for automatic proposal service.
 */
export interface AutomaticProposalServiceOptions {
  readonly pool: Pool;
  readonly graph: IGraphDatabase;
  readonly logger: ILogger;
  readonly governancePdsWriter: GovernancePDSWriter;
  readonly graphPdsDid: DID;
}

/**
 * Service for creating automatic governance proposals.
 */
@singleton()
export class AutomaticProposalService {
  private readonly pool: Pool;
  private readonly graph: IGraphDatabase;
  private readonly logger: ILogger;
  private readonly governancePdsWriter: GovernancePDSWriter;
  private readonly graphPdsDid: DID;

  constructor(options: AutomaticProposalServiceOptions) {
    this.pool = options.pool;
    this.graph = options.graph;
    this.logger = options.logger;
    this.governancePdsWriter = options.governancePdsWriter;
    this.graphPdsDid = options.graphPdsDid;
  }

  /**
   * Check if an author node already exists in the knowledge graph.
   */
  private async authorNodeExists(authorDid: DID): Promise<boolean> {
    const uuid = nodeUuid('author', authorDid);
    const uri = `at://${this.graphPdsDid}/pub.chive.graph.node/${uuid}` as AtUri;
    const node = await this.graph.getNodeByUri(uri);
    return node !== null;
  }

  /**
   * Check if an eprint node already exists in the knowledge graph.
   */
  private async eprintNodeExists(eprintUri: AtUri): Promise<boolean> {
    // Extract the UUID from the eprint URI
    const uriParts = eprintUri.split('/');
    const uriId = uriParts[uriParts.length - 1] ?? eprintUri;
    const uuid = nodeUuid('eprint', uriId);
    const nodeUri = `at://${this.graphPdsDid}/pub.chive.graph.node/${uuid}` as AtUri;
    const node = await this.graph.getNodeByUri(nodeUri);
    return node !== null;
  }

  /**
   * Check if an institution node exists by name or ROR ID.
   */
  private async institutionNodeExists(
    name: string,
    rorId?: string
  ): Promise<{ exists: boolean; uri?: AtUri }> {
    // Search for institution nodes by name
    const searchResults = await this.graph.searchNodes(name, {
      kind: 'object',
      subkind: 'institution',
      status: 'established' as const,
      limit: 10,
    });

    // Check for exact name match
    const exactMatch = searchResults.nodes.find(
      (node) => node.label.toLowerCase() === name.toLowerCase()
    );
    if (exactMatch) {
      return { exists: true, uri: exactMatch.uri };
    }

    // Check for ROR ID match if provided
    if (rorId) {
      const rorMatch = searchResults.nodes.find((node) =>
        node.externalIds?.some((ext) => ext.system === 'ror' && ext.identifier === rorId)
      );
      if (rorMatch) {
        return { exists: true, uri: rorMatch.uri };
      }
    }

    return { exists: false };
  }

  /**
   * Check if this is the author's first eprint submission.
   */
  private async isFirstEprintSubmission(authorDid: DID): Promise<boolean> {
    const result = await this.pool.query<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM eprints_index
       WHERE $1 = ANY(
         SELECT jsonb_array_elements(authors::jsonb)->>'did'
       )
       OR submitted_by = $1`,
      [authorDid]
    );

    const count = result.rows[0]?.count ?? 0;
    return count <= 1; // Current submission + possibly one other
  }

  /**
   * Create an automatic author proposal.
   *
   * @param author - Author information from eprint
   * @param eprintUri - URI of the eprint that triggered this proposal
   * @returns Proposal URI if created, null if skipped
   */
  async createAuthorProposal(author: EprintAuthor, eprintUri: AtUri): Promise<AtUri | null> {
    // Only create proposals for authors with ATProto identities
    if (!author.did) {
      this.logger.debug('Skipping author proposal: no ATProto DID', {
        authorName: author.name,
        eprintUri,
      });
      return null;
    }

    // Check if author node already exists
    if (await this.authorNodeExists(author.did)) {
      this.logger.debug('Skipping author proposal: node already exists', {
        authorDid: author.did,
        eprintUri,
      });
      return null;
    }

    // Check if this is the author's first eprint
    const isFirst = await this.isFirstEprintSubmission(author.did);
    if (!isFirst) {
      this.logger.debug('Skipping author proposal: not first eprint', {
        authorDid: author.did,
        eprintUri,
      });
      return null;
    }

    // Build external IDs
    const externalIds: { system: string; identifier: string }[] = [];
    if (author.orcid) {
      externalIds.push({ system: 'orcid', identifier: author.orcid });
    }

    // Create proposal in Governance PDS
    const uuid = nodeUuid('author', author.did);
    const proposalRkey = `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const proposalRecord = {
      $type: 'pub.chive.graph.nodeProposal',
      proposalType: 'create',
      kind: 'object',
      subkind: 'author',
      proposedNode: {
        label: author.name,
        description: author.email ? `Author email: ${author.email}` : undefined,
        externalIds: externalIds.length > 0 ? externalIds : undefined,
        metadata: {
          generatedId: uuid,
        },
      },
      rationale: `Automatic proposal: Author ${author.name} (${author.did}) submitted their first eprint (${eprintUri}).`,
      evidence: [
        {
          type: 'usage',
          uri: eprintUri,
          description: `First eprint submission by this author`,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    try {
      const result = await this.governancePdsWriter.createProposalBootstrap(
        'pub.chive.graph.nodeProposal' as NSID,
        proposalRkey,
        proposalRecord
      );

      if (!result.ok) {
        this.logger.error('Failed to create author proposal', undefined, {
          authorDid: author.did,
          error: result.error.message,
        });
        return null;
      }

      this.logger.info('Created automatic author proposal', {
        authorDid: author.did,
        proposalUri: result.value.uri,
        eprintUri,
      });

      return result.value.uri;
    } catch (error) {
      this.logger.error(
        'Error creating author proposal',
        error instanceof Error ? error : undefined,
        {
          authorDid: author.did,
          eprintUri,
        }
      );
      return null;
    }
  }

  /**
   * Create an automatic eprint proposal.
   *
   * @param eprint - Eprint record
   * @param eprintUri - URI of the eprint
   * @returns Proposal URI if created, null if skipped
   */
  async createEprintProposal(eprint: Eprint, eprintUri: AtUri): Promise<AtUri | null> {
    // Check if eprint node already exists
    if (await this.eprintNodeExists(eprintUri)) {
      this.logger.debug('Skipping eprint proposal: node already exists', { eprintUri });
      return null;
    }

    // Extract UUID from eprint URI
    const uriParts = eprintUri.split('/');
    const uriId = uriParts[uriParts.length - 1] ?? eprintUri;
    const uuid = nodeUuid('eprint', uriId);

    // Build external IDs from eprint metadata
    const externalIds: { system: string; identifier: string }[] = [];
    // Note: DOI is stored in publishedVersion.doi, not externalIds
    if (eprint.publishedVersion?.doi) {
      externalIds.push({ system: 'doi', identifier: eprint.publishedVersion.doi });
    }
    if (eprint.externalIds?.arxivId) {
      externalIds.push({ system: 'arxiv', identifier: eprint.externalIds.arxivId });
    }
    if (eprint.externalIds?.pmid) {
      externalIds.push({ system: 'pmid', identifier: eprint.externalIds.pmid });
    }

    const proposalRkey = `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const proposalRecord = {
      $type: 'pub.chive.graph.nodeProposal',
      proposalType: 'create',
      kind: 'object',
      subkind: 'eprint',
      proposedNode: {
        label: eprint.title,
        description: eprint.abstract ? extractPlainText(eprint.abstract).slice(0, 500) : undefined,
        externalIds: externalIds.length > 0 ? externalIds : undefined,
        metadata: {
          generatedId: uuid,
          originalUri: eprintUri,
          submittedBy: eprint.submittedBy,
        },
      },
      rationale: `Automatic proposal: Eprint "${eprint.title}" submitted to Chive.`,
      evidence: [
        {
          type: 'usage',
          uri: eprintUri,
          description: `Eprint submission record`,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    try {
      const result = await this.governancePdsWriter.createProposalBootstrap(
        'pub.chive.graph.nodeProposal' as NSID,
        proposalRkey,
        proposalRecord
      );

      if (!result.ok) {
        this.logger.error('Failed to create eprint proposal', undefined, {
          eprintUri,
          error: result.error.message,
        });
        return null;
      }

      this.logger.info('Created automatic eprint proposal', {
        eprintUri,
        proposalUri: result.value.uri,
      });

      return result.value.uri;
    } catch (error) {
      this.logger.error(
        'Error creating eprint proposal',
        error instanceof Error ? error : undefined,
        { eprintUri }
      );
      return null;
    }
  }

  /**
   * Create an automatic institution proposal.
   *
   * @param name - Institution name
   * @param rorId - Optional ROR ID
   * @param triggerUri - URI of the record that triggered this proposal (eprint or profile)
   * @param triggerType - Type of trigger ('eprint' or 'profile')
   * @returns Proposal URI if created, null if skipped
   */
  async createInstitutionProposal(
    name: string,
    rorId: string | undefined,
    triggerUri: AtUri,
    triggerType: 'eprint' | 'profile'
  ): Promise<AtUri | null> {
    // Check if institution already exists
    const exists = await this.institutionNodeExists(name, rorId);
    if (exists.exists) {
      this.logger.debug('Skipping institution proposal: node already exists', {
        name,
        rorId,
        existingUri: exists.uri,
      });
      return null;
    }

    // Generate deterministic UUID for the institution
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const uuid = nodeUuid('institution', slug);

    // Build external IDs
    const externalIds: { system: string; identifier: string }[] = [];
    if (rorId) {
      externalIds.push({ system: 'ror', identifier: rorId });
    }

    const proposalRkey = `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const proposalRecord = {
      $type: 'pub.chive.graph.nodeProposal',
      proposalType: 'create',
      kind: 'object',
      subkind: 'institution',
      proposedNode: {
        label: name,
        externalIds: externalIds.length > 0 ? externalIds : undefined,
        metadata: {
          generatedId: uuid,
        },
      },
      rationale: `Automatic proposal: Institution "${name}" referenced in ${triggerType} (${triggerUri}).`,
      evidence: [
        {
          type: 'usage',
          uri: triggerUri,
          description: `Referenced in ${triggerType}`,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    try {
      const result = await this.governancePdsWriter.createProposalBootstrap(
        'pub.chive.graph.nodeProposal' as NSID,
        proposalRkey,
        proposalRecord
      );

      if (!result.ok) {
        this.logger.error('Failed to create institution proposal', undefined, {
          name,
          rorId,
          error: result.error.message,
        });
        return null;
      }

      this.logger.info('Created automatic institution proposal', {
        name,
        rorId,
        proposalUri: result.value.uri,
        triggerUri,
        triggerType,
      });

      return result.value.uri;
    } catch (error) {
      this.logger.error(
        'Error creating institution proposal',
        error instanceof Error ? error : undefined,
        {
          name,
          rorId,
          triggerUri,
        }
      );
      return null;
    }
  }

  /**
   * Process eprint submission and create automatic proposals.
   *
   * @param eprint - Eprint record
   * @param eprintUri - URI of the eprint
   */
  async processEprintSubmission(eprint: Eprint, eprintUri: AtUri): Promise<void> {
    // Create eprint proposal immediately
    await this.createEprintProposal(eprint, eprintUri);

    // Create author proposals for authors with ATProto identities
    for (const author of eprint.authors) {
      if (author.did) {
        await this.createAuthorProposal(author, eprintUri);
      }
    }

    // Create institution proposals from author affiliations
    const institutionNames = new Set<string>();
    for (const author of eprint.authors) {
      for (const affiliation of author.affiliations) {
        const key = `${affiliation.name}|${affiliation.rorId ?? ''}`;
        if (!institutionNames.has(key)) {
          institutionNames.add(key);
          await this.createInstitutionProposal(
            affiliation.name,
            affiliation.rorId,
            eprintUri,
            'eprint'
          );
        }
      }
    }
  }

  /**
   * Process profile update and create institution proposals.
   *
   * @param did - User DID
   * @param affiliations - List of affiliations from profile
   * @param profileUri - URI of the profile record
   */
  async processProfileUpdate(
    _did: DID,
    affiliations: { name: string; rorId?: string }[],
    profileUri: AtUri
  ): Promise<void> {
    // Create institution proposals for new affiliations
    for (const affiliation of affiliations) {
      await this.createInstitutionProposal(
        affiliation.name,
        affiliation.rorId,
        profileUri,
        'profile'
      );
    }
  }

  /**
   * Create citation proposals for discovered citations.
   *
   * @remarks
   * This sets up infrastructure for citation proposals. The actual parsing
   * of citations from papers is deferred to a future implementation.
   * When citations are discovered (e.g., through Semantic Scholar or OpenAlex),
   * this method can be called to create governance proposals for citation edges.
   *
   * @param citingUri - URI of the citing eprint
   * @param citedUri - URI of the cited eprint
   * @param source - Source of the citation (e.g., 'semantic-scholar', 'openalex', 'parsed')
   * @returns Proposal URI if created, null if skipped
   */
  async createCitationProposal(
    citingUri: AtUri,
    citedUri: AtUri,
    source: string
  ): Promise<AtUri | null> {
    // Check if both eprint nodes exist
    const citingExists = await this.eprintNodeExists(citingUri);
    const citedExists = await this.eprintNodeExists(citedUri);

    if (!citingExists || !citedExists) {
      this.logger.debug('Skipping citation proposal: one or both eprints not in knowledge graph', {
        citingUri,
        citedUri,
        citingExists,
        citedExists,
      });
      return null;
    }

    // Extract UUIDs from URIs
    const citingUriParts = citingUri.split('/');
    const citingUriId = citingUriParts[citingUriParts.length - 1] ?? citingUri;
    const citingUuid = nodeUuid('eprint', citingUriId);

    const citedUriParts = citedUri.split('/');
    const citedUriId = citedUriParts[citedUriParts.length - 1] ?? citedUri;
    const citedUuid = nodeUuid('eprint', citedUriId);

    // Build source and target URIs for the edge
    const sourceNodeUri = `at://${this.graphPdsDid}/pub.chive.graph.node/${citingUuid}` as AtUri;
    const targetNodeUri = `at://${this.graphPdsDid}/pub.chive.graph.node/${citedUuid}` as AtUri;

    const proposalRkey = `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const proposalRecord = {
      $type: 'pub.chive.graph.edgeProposal',
      proposalType: 'create',
      sourceUri: sourceNodeUri,
      targetUri: targetNodeUri,
      relationSlug: 'cites',
      rationale: `Automatic proposal: Citation discovered from ${source}. Eprint ${citingUri} cites ${citedUri}.`,
      evidence: [
        {
          type: 'usage',
          uri: citingUri,
          description: `Citing eprint`,
        },
        {
          type: 'usage',
          uri: citedUri,
          description: `Cited eprint`,
        },
      ],
      metadata: {
        source,
        discoveredAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    };

    try {
      const result = await this.governancePdsWriter.createProposalBootstrap(
        'pub.chive.graph.edgeProposal' as NSID,
        proposalRkey,
        proposalRecord
      );

      if (!result.ok) {
        this.logger.error('Failed to create citation proposal', undefined, {
          citingUri,
          citedUri,
          error: result.error.message,
        });
        return null;
      }

      this.logger.info('Created automatic citation proposal', {
        citingUri,
        citedUri,
        proposalUri: result.value.uri,
        source,
      });

      return result.value.uri;
    } catch (error) {
      this.logger.error(
        'Error creating citation proposal',
        error instanceof Error ? error : undefined,
        {
          citingUri,
          citedUri,
          source,
        }
      );
      return null;
    }
  }
}
