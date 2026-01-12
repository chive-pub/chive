/**
 * ContributionTypeManager for CRediT-based author contribution taxonomy.
 *
 * @remarks
 * Manages the 14 CRediT (Contributor Roles Taxonomy) contribution types plus
 * community-proposed additions. Types are stored in the knowledge graph for
 * efficient lookups and relationship queries.
 *
 * **CRediT Taxonomy**:
 * https://credit.niso.org/
 *
 * All contribution types are sourced from Governance PDS and indexed in Neo4j.
 * Community can propose new types through the governance workflow.
 *
 * @example
 * ```typescript
 * const manager = container.resolve(ContributionTypeManager);
 *
 * // Initialize CRediT taxonomy
 * await manager.initializeContributionTypes();
 *
 * // Get all types
 * const types = await manager.listContributionTypes();
 *
 * // Get type by ID
 * const type = await manager.getContributionType('conceptualization');
 * ```
 *
 * @packageDocumentation
 */

import { singleton } from 'tsyringe';

import type { AtUri, Timestamp } from '../../types/atproto.js';
import { DatabaseError, NotFoundError } from '../../types/errors.js';
import type { ContributionDegree } from '../../types/models/author.js';
import type {
  ContributionMappingSystem,
  ContributionType,
  ContributionTypeExternalMapping,
  ContributionTypeStatus,
  SemanticMatchType,
} from '../../types/models/contribution.js';

import { Neo4jConnection } from './connection.js';
import { getGovernanceDid } from './setup.js';

/**
 * External ontology mapping for contribution types.
 */
export interface ExternalMapping {
  readonly system: string;
  readonly identifier: string;
  readonly uri: string;
  readonly matchType?: SemanticMatchType;
}

/**
 * CRediT role definition for seeding.
 */
interface CreditRole {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly creditUri: string;
  readonly croUri?: string;
}

/**
 * The 14 CRediT (Contributor Roles Taxonomy) roles.
 *
 * Source: https://credit.niso.org/
 */
const CREDIT_TAXONOMY: readonly CreditRole[] = [
  {
    id: 'conceptualization',
    label: 'Conceptualization',
    description: 'Ideas; formulation or evolution of overarching research goals and aims.',
    creditUri: 'https://credit.niso.org/contributor-roles/conceptualization/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000064',
  },
  {
    id: 'data-curation',
    label: 'Data Curation',
    description:
      'Management activities to annotate (produce metadata), scrub data and maintain research data for initial use and later re-use.',
    creditUri: 'https://credit.niso.org/contributor-roles/data-curation/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000025',
  },
  {
    id: 'formal-analysis',
    label: 'Formal Analysis',
    description:
      'Application of statistical, mathematical, computational, or other formal techniques to analyze or synthesize study data.',
    creditUri: 'https://credit.niso.org/contributor-roles/formal-analysis/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000006',
  },
  {
    id: 'funding-acquisition',
    label: 'Funding Acquisition',
    description:
      'Acquisition of the financial support for the project leading to this publication.',
    creditUri: 'https://credit.niso.org/contributor-roles/funding-acquisition/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000020',
  },
  {
    id: 'investigation',
    label: 'Investigation',
    description:
      'Conducting a research and investigation process, specifically performing the experiments, or data/evidence collection.',
    creditUri: 'https://credit.niso.org/contributor-roles/investigation/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000052',
  },
  {
    id: 'methodology',
    label: 'Methodology',
    description: 'Development or design of methodology; creation of models.',
    creditUri: 'https://credit.niso.org/contributor-roles/methodology/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000029',
  },
  {
    id: 'project-administration',
    label: 'Project Administration',
    description:
      'Management and coordination responsibility for the research activity planning and execution.',
    creditUri: 'https://credit.niso.org/contributor-roles/project-administration/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000053',
  },
  {
    id: 'resources',
    label: 'Resources',
    description:
      'Provision of study materials, reagents, materials, patients, laboratory samples, animals, instrumentation, computing resources, or other analysis tools.',
    creditUri: 'https://credit.niso.org/contributor-roles/resources/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000054',
  },
  {
    id: 'software',
    label: 'Software',
    description:
      'Programming, software development; designing computer programs; implementation of the computer code and supporting algorithms; testing of existing code components.',
    creditUri: 'https://credit.niso.org/contributor-roles/software/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000015',
  },
  {
    id: 'supervision',
    label: 'Supervision',
    description:
      'Oversight and leadership responsibility for the research activity planning and execution, including mentorship external to the core team.',
    creditUri: 'https://credit.niso.org/contributor-roles/supervision/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000055',
  },
  {
    id: 'validation',
    label: 'Validation',
    description:
      'Verification, whether as a part of the activity or separate, of the overall replication/reproducibility of results/experiments and other research outputs.',
    creditUri: 'https://credit.niso.org/contributor-roles/validation/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000056',
  },
  {
    id: 'visualization',
    label: 'Visualization',
    description:
      'Preparation, creation and/or presentation of the published work, specifically visualization/data presentation.',
    creditUri: 'https://credit.niso.org/contributor-roles/visualization/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000059',
  },
  {
    id: 'writing-original-draft',
    label: 'Writing - Original Draft',
    description:
      'Preparation, creation and/or presentation of the published work, specifically writing the initial draft.',
    creditUri: 'https://credit.niso.org/contributor-roles/writing-original-draft/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000057',
  },
  {
    id: 'writing-review-editing',
    label: 'Writing - Review & Editing',
    description:
      'Preparation, creation and/or presentation of the published work by those from the original research group, specifically critical review, commentary or revision.',
    creditUri: 'https://credit.niso.org/contributor-roles/writing-review-editing/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000058',
  },
];

/**
 * Contribution type search result.
 */
export interface ContributionTypeSearchResult {
  readonly types: ContributionType[];
  readonly total: number;
}

/**
 * Manager for CRediT-based contribution type taxonomy.
 *
 * @example
 * ```typescript
 * const manager = container.resolve(ContributionTypeManager);
 * await manager.initializeContributionTypes();
 *
 * const types = await manager.listContributionTypes();
 * console.log(types); // 14 CRediT roles
 * ```
 */
@singleton()
export class ContributionTypeManager {
  /**
   * The 14 CRediT contribution roles.
   */
  static readonly CREDIT_ROLES = CREDIT_TAXONOMY;

  /**
   * Valid contribution degrees.
   */
  static readonly VALID_DEGREES: readonly ContributionDegree[] = ['lead', 'equal', 'supporting'];

  constructor(private connection: Neo4jConnection) {}

  /**
   * Initialize CRediT contribution types in the database.
   *
   * Creates the 14 CRediT ContributionType nodes if they don't exist.
   * This is idempotent and safe to run multiple times.
   *
   * @throws {DatabaseError} If database initialization fails
   *
   * @example
   * ```typescript
   * await manager.initializeContributionTypes();
   * // Creates 14 ContributionType nodes
   * ```
   */
  async initializeContributionTypes(): Promise<void> {
    await this.connection.executeTransaction(async (tx) => {
      for (const role of CREDIT_TAXONOMY) {
        const externalMappings: ExternalMapping[] = [
          {
            system: 'credit',
            identifier: role.id,
            uri: role.creditUri,
            matchType: 'exact-match',
          },
        ];

        if (role.croUri) {
          externalMappings.push({
            system: 'cro',
            identifier: role.croUri.split('/').pop() ?? role.id,
            uri: role.croUri,
            matchType: 'exact-match',
          });
        }

        await tx.run(
          `
          MERGE (ct:ContributionType {typeId: $typeId})
          ON CREATE SET
            ct.uri = $uri,
            ct.label = $label,
            ct.description = $description,
            ct.externalMappings = $externalMappings,
            ct.status = 'established',
            ct.proposalUri = null,
            ct.source = 'credit',
            ct.createdAt = datetime()
          ON MATCH SET
            ct.label = $label,
            ct.description = $description,
            ct.externalMappings = $externalMappings,
            ct.updatedAt = datetime()
          `,
          {
            typeId: role.id,
            uri: `at://${getGovernanceDid()}/pub.chive.contribution.type/${role.id}`,
            label: role.label,
            description: role.description,
            externalMappings: JSON.stringify(externalMappings),
          }
        );
      }
    });
  }

  /**
   * Get all contribution types.
   *
   * @param options - Query options
   * @returns Array of contribution types
   *
   * @example
   * ```typescript
   * const types = await manager.listContributionTypes();
   * console.log(types.length); // 14+
   * ```
   */
  async listContributionTypes(options?: {
    status?: ContributionTypeStatus;
    limit?: number;
    offset?: number;
  }): Promise<ContributionTypeSearchResult> {
    const status = options?.status;
    // Ensure limit and offset are integers (Neo4j requires integer values)
    const limit = Math.floor(options?.limit ?? 100);
    const offset = Math.floor(options?.offset ?? 0);

    const whereClause = status ? 'WHERE ct.status = $status' : '';

    const query = `
      MATCH (ct:ContributionType)
      ${whereClause}
      RETURN ct
      ORDER BY ct.label ASC
      SKIP $offset
      LIMIT $limit
    `;

    const countQuery = `
      MATCH (ct:ContributionType)
      ${whereClause}
      RETURN count(ct) as total
    `;

    const [result, countResult] = await Promise.all([
      this.connection.executeQuery<{ ct: Record<string, unknown> }>(query, {
        status,
        offset,
        limit,
      }),
      this.connection.executeQuery<{ total: number }>(countQuery, { status }),
    ]);

    const types = result.records.map((record) => this.recordToContributionType(record.get('ct')));
    const total = countResult.records[0]?.get('total') ?? 0;

    return { types, total };
  }

  /**
   * Get contribution type by ID.
   *
   * @param typeId - Type identifier (e.g., 'conceptualization')
   * @returns Contribution type or null if not found
   *
   * @example
   * ```typescript
   * const type = await manager.getContributionType('conceptualization');
   * console.log(type?.label); // 'Conceptualization'
   * ```
   */
  async getContributionType(typeId: string): Promise<ContributionType | null> {
    const query = `
      MATCH (ct:ContributionType {typeId: $typeId})
      RETURN ct
    `;

    const result = await this.connection.executeQuery<{ ct: Record<string, unknown> }>(query, {
      typeId,
    });

    const firstRecord = result.records[0];
    if (!firstRecord) {
      return null;
    }

    return this.recordToContributionType(firstRecord.get('ct'));
  }

  /**
   * Get contribution type by AT-URI.
   *
   * @param uri - AT-URI of the contribution type
   * @returns Contribution type
   * @throws {NotFoundError} If type not found
   *
   * @example
   * ```typescript
   * const type = await manager.getContributionTypeByUri(
   *   'at://did:plc:governance/pub.chive.contribution.type/conceptualization'
   * );
   * ```
   */
  async getContributionTypeByUri(uri: AtUri): Promise<ContributionType> {
    const query = `
      MATCH (ct:ContributionType {uri: $uri})
      RETURN ct
    `;

    const result = await this.connection.executeQuery<{ ct: Record<string, unknown> }>(query, {
      uri,
    });

    const firstRecord = result.records[0];
    if (!firstRecord) {
      throw new NotFoundError('contribution_type', uri);
    }

    return this.recordToContributionType(firstRecord.get('ct'));
  }

  /**
   * Search contribution types by label.
   *
   * @param searchTerm - Search term to match against label
   * @param limit - Maximum results to return
   * @returns Matching contribution types
   *
   * @example
   * ```typescript
   * const results = await manager.searchContributionTypes('writing');
   * // Returns 'Writing - Original Draft' and 'Writing - Review & Editing'
   * ```
   */
  async searchContributionTypes(
    searchTerm: string,
    limit = 10
  ): Promise<ContributionTypeSearchResult> {
    // Ensure limit is an integer (Neo4j requires integer values)
    const limitInt = Math.floor(limit);

    const query = `
      MATCH (ct:ContributionType)
      WHERE toLower(ct.label) CONTAINS toLower($searchTerm)
         OR toLower(ct.description) CONTAINS toLower($searchTerm)
      RETURN ct
      ORDER BY ct.label ASC
      LIMIT $limit
    `;

    const result = await this.connection.executeQuery<{ ct: Record<string, unknown> }>(query, {
      searchTerm,
      limit: limitInt,
    });

    const types = result.records.map((record) => this.recordToContributionType(record.get('ct')));

    return { types, total: types.length };
  }

  /**
   * Create a new contribution type from an approved proposal.
   *
   * @param type - Contribution type data
   * @returns Created contribution type
   * @throws {DatabaseError} If creation fails
   *
   * @remarks
   * Only call this after a proposal has been approved through governance.
   *
   * @example
   * ```typescript
   * const type = await manager.createContributionType({
   *   uri: 'at://did:plc:governance/pub.chive.contribution.type/clinical-trials',
   *   id: 'clinical-trials',
   *   label: 'Clinical Trials',
   *   description: 'Conducting clinical trials...',
   *   externalMappings: [],
   *   status: 'established',
   *   proposalUri: 'at://did:plc:user/pub.chive.contribution.typeProposal/abc',
   *   createdAt: Date.now(),
   * });
   * ```
   */
  async createContributionType(type: ContributionType): Promise<ContributionType> {
    const query = `
      CREATE (ct:ContributionType {
        uri: $uri,
        typeId: $typeId,
        label: $label,
        description: $description,
        externalMappings: $externalMappings,
        status: $status,
        proposalUri: $proposalUri,
        source: 'community',
        createdAt: datetime()
      })
      RETURN ct
    `;

    try {
      const result = await this.connection.executeQuery<{ ct: Record<string, unknown> }>(query, {
        uri: type.uri,
        typeId: type.id,
        label: type.label,
        description: type.description,
        externalMappings: JSON.stringify(type.externalMappings ?? []),
        status: type.status,
        proposalUri: type.proposalUri ?? null,
      });

      const firstRecord = result.records[0];
      if (!firstRecord) {
        throw new DatabaseError('CREATE', 'Failed to create contribution type');
      }

      return this.recordToContributionType(firstRecord.get('ct'));
    } catch (err) {
      throw new DatabaseError(
        'CREATE',
        err instanceof Error ? err.message : 'Failed to create contribution type'
      );
    }
  }

  /**
   * Update contribution type status (for deprecation).
   *
   * @param typeId - Type identifier
   * @param status - New status
   * @throws {NotFoundError} If type not found
   *
   * @example
   * ```typescript
   * await manager.updateContributionTypeStatus('old-type', 'deprecated');
   * ```
   */
  async updateContributionTypeStatus(
    typeId: string,
    status: ContributionTypeStatus
  ): Promise<void> {
    const query = `
      MATCH (ct:ContributionType {typeId: $typeId})
      SET ct.status = $status, ct.updatedAt = datetime()
      RETURN ct
    `;

    const result = await this.connection.executeQuery<{ ct: Record<string, unknown> }>(query, {
      typeId,
      status,
    });

    if (result.records.length === 0) {
      throw new NotFoundError('contribution_type', typeId);
    }
  }

  /**
   * Get CRediT role by ID.
   *
   * Returns the static CRediT role definition without database access.
   *
   * @param typeId - Type identifier
   * @returns CRediT role definition or undefined
   */
  getCreditRole(typeId: string): CreditRole | undefined {
    return CREDIT_TAXONOMY.find((role) => role.id === typeId);
  }

  /**
   * Validate contribution degree.
   *
   * @param degree - Degree to validate
   * @returns True if valid degree
   */
  isValidDegree(degree: string): degree is ContributionDegree {
    return ContributionTypeManager.VALID_DEGREES.includes(degree as ContributionDegree);
  }

  /**
   * Convert Neo4j record to ContributionType.
   *
   * @param record - Neo4j record properties
   * @returns ContributionType object
   */
  private recordToContributionType(record: Record<string, unknown>): ContributionType {
    const rawMappings =
      typeof record.externalMappings === 'string'
        ? (JSON.parse(record.externalMappings) as ExternalMapping[])
        : (record.externalMappings as ExternalMapping[] | undefined);
    // Convert ExternalMapping to ContributionTypeExternalMapping with validated system type
    const externalMappings: readonly ContributionTypeExternalMapping[] = (rawMappings ?? []).map(
      (m) => ({
        system: m.system as ContributionMappingSystem,
        identifier: m.identifier,
        uri: m.uri,
        matchType: m.matchType,
      })
    );

    // Convert Neo4j datetime to timestamp (milliseconds since epoch)
    let createdAt: Timestamp;
    if (record.createdAt) {
      const dateValue = record.createdAt as string | { toStandardDate?: () => Date };
      if (typeof dateValue === 'string') {
        createdAt = new Date(dateValue).getTime() as Timestamp;
      } else if (dateValue.toStandardDate) {
        createdAt = dateValue.toStandardDate().getTime() as Timestamp;
      } else {
        createdAt = Date.now() as Timestamp;
      }
    } else {
      createdAt = Date.now() as Timestamp;
    }

    return {
      uri: record.uri as AtUri,
      id: record.typeId as string,
      label: record.label as string,
      description: (record.description as string) ?? '',
      externalMappings,
      status: (record.status as ContributionTypeStatus) ?? 'established',
      proposalUri: record.proposalUri as AtUri | undefined,
      createdAt,
    };
  }
}
