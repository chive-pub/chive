/**
 * Neo4j repository for author operations.
 *
 * @remarks
 * Manages author nodes in the knowledge graph as read-only indexes.
 * Includes external identifiers (ORCID, Google Scholar, etc.) and
 * relationships to institutions and fields.
 *
 * @packageDocumentation
 * @public
 */

import neo4j from 'neo4j-driver';
import { singleton } from 'tsyringe';

import type { AtUri, DID } from '../../types/atproto.js';
import { DatabaseError, NotFoundError } from '../../types/errors.js';

import { Neo4jConnection } from './connection.js';
import type { GraphNode, NodeMetadata } from './types.js';

/**
 * Author external ID source types.
 */
export type AuthorIdSource =
  | 'orcid'
  | 'googleScholar'
  | 'semanticScholar'
  | 'scopus'
  | 'dblp'
  | 'viaf'
  | 'isni'
  | 'openAlex';

/**
 * Author external ID.
 */
export interface AuthorExternalId {
  source: AuthorIdSource;
  id: string;
  url?: string;
  verified?: boolean;
  verifiedAt?: Date;
}

/**
 * Author node in the knowledge graph.
 */
export interface AuthorNode {
  /** User DID */
  did: DID;
  /** Display name */
  name: string;
  /** ORCID identifier */
  orcid?: string;
  /** Google Scholar ID */
  googleScholarId?: string;
  /** Semantic Scholar ID */
  semanticScholarId?: string;
  /** Scopus Author ID */
  scopusId?: string;
  /** DBLP ID */
  dblpId?: string;
  /** VIAF ID */
  viafId?: string;
  /** ISNI */
  isni?: string;
  /** OpenAlex ID */
  openAlexId?: string;
  /** Biography */
  bio?: string;
  /** Website URL */
  website?: string;
  /** Primary affiliation URI */
  primaryAffiliationUri?: AtUri;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt?: Date;
}

/**
 * Author search result.
 */
export interface AuthorSearchResult {
  authors: AuthorNode[];
  total: number;
}

/**
 * Co-author with collaboration count.
 */
export interface Collaborator {
  did: DID;
  name: string;
  orcid?: string;
  collaborationCount: number;
  fields?: string[];
}

/**
 * Author creation input.
 */
export type AuthorInput = Omit<AuthorNode, 'createdAt' | 'updatedAt'>;

/**
 * Author update input.
 */
export type AuthorUpdate = Partial<Omit<AuthorNode, 'did' | 'createdAt'>>;

/**
 * Neo4j repository for author operations.
 *
 * @example
 * ```typescript
 * const repo = container.resolve(AuthorRepository);
 *
 * // Get author by DID
 * const author = await repo.getAuthor('did:plc:abc123');
 *
 * // Get author's collaborators
 * const collaborators = await repo.getCollaborators('did:plc:abc123', 10);
 *
 * // Get author's expertise fields
 * const fields = await repo.getAuthorFields('did:plc:abc123');
 * ```
 *
 * @public
 */
@singleton()
export class AuthorRepository {
  constructor(private connection: Neo4jConnection) {}

  /**
   * Create or update an author node.
   *
   * @param author - Author data
   * @returns Author DID
   */
  async upsertAuthor(author: AuthorInput): Promise<DID> {
    const query = `
      MERGE (a:Author {did: $did})
      ON CREATE SET
        a.name = $name,
        a.orcid = $orcid,
        a.googleScholarId = $googleScholarId,
        a.semanticScholarId = $semanticScholarId,
        a.scopusId = $scopusId,
        a.dblpId = $dblpId,
        a.viafId = $viafId,
        a.isni = $isni,
        a.openAlexId = $openAlexId,
        a.bio = $bio,
        a.website = $website,
        a.primaryAffiliationUri = $primaryAffiliationUri,
        a.createdAt = datetime()
      ON MATCH SET
        a.name = $name,
        a.orcid = COALESCE($orcid, a.orcid),
        a.googleScholarId = COALESCE($googleScholarId, a.googleScholarId),
        a.semanticScholarId = COALESCE($semanticScholarId, a.semanticScholarId),
        a.scopusId = COALESCE($scopusId, a.scopusId),
        a.dblpId = COALESCE($dblpId, a.dblpId),
        a.viafId = COALESCE($viafId, a.viafId),
        a.isni = COALESCE($isni, a.isni),
        a.openAlexId = COALESCE($openAlexId, a.openAlexId),
        a.bio = COALESCE($bio, a.bio),
        a.website = COALESCE($website, a.website),
        a.primaryAffiliationUri = COALESCE($primaryAffiliationUri, a.primaryAffiliationUri),
        a.updatedAt = datetime()
      RETURN a.did AS did
    `;

    const result = await this.connection.executeQuery<{ did: DID }>(query, {
      did: author.did,
      name: author.name,
      orcid: author.orcid ?? null,
      googleScholarId: author.googleScholarId ?? null,
      semanticScholarId: author.semanticScholarId ?? null,
      scopusId: author.scopusId ?? null,
      dblpId: author.dblpId ?? null,
      viafId: author.viafId ?? null,
      isni: author.isni ?? null,
      openAlexId: author.openAlexId ?? null,
      bio: author.bio ?? null,
      website: author.website ?? null,
      primaryAffiliationUri: author.primaryAffiliationUri ?? null,
    });

    const record = result.records[0];
    if (!record) {
      throw new Error('Failed to upsert author');
    }

    return record.get('did');
  }

  /**
   * Get an author by DID.
   *
   * @param did - Author DID
   * @returns Author node or null if not found
   */
  async getAuthor(did: DID): Promise<AuthorNode | null> {
    const query = `
      MATCH (a:Author {did: $did})
      RETURN a
    `;

    const result = await this.connection.executeQuery<{ a: Record<string, unknown> }>(query, {
      did,
    });
    const record = result.records[0];

    if (!record) {
      return null;
    }

    const node = record.get('a');
    const props = (node.properties ?? node) as Record<string, string | number | Date | null>;
    return this.mapRecordToAuthor(props);
  }

  /**
   * Get an author by ORCID.
   *
   * @param orcid - ORCID identifier (with or without prefix)
   * @returns Author node or null if not found
   */
  async getAuthorByOrcid(orcid: string): Promise<AuthorNode | null> {
    // Normalize ORCID - remove any prefix
    const normalizedOrcid = orcid.replace(/^https?:\/\/orcid\.org\//, '');

    const query = `
      MATCH (a:Author {orcid: $orcid})
      RETURN a
    `;

    const result = await this.connection.executeQuery<{ a: Record<string, unknown> }>(query, {
      orcid: normalizedOrcid,
    });
    const record = result.records[0];

    if (!record) {
      return null;
    }

    const node = record.get('a');
    const props = (node.properties ?? node) as Record<string, string | number | Date | null>;
    return this.mapRecordToAuthor(props);
  }

  /**
   * Update an author.
   *
   * @param did - Author DID
   * @param updates - Fields to update
   * @throws {NotFoundError} If author not found
   */
  async updateAuthor(did: DID, updates: AuthorUpdate): Promise<void> {
    const setClauses: string[] = ['a.updatedAt = datetime()'];
    const params: Record<string, string | null> = { did };

    if (updates.name !== undefined) {
      setClauses.push('a.name = $name');
      params.name = updates.name;
    }

    if (updates.orcid !== undefined) {
      setClauses.push('a.orcid = $orcid');
      params.orcid = updates.orcid ?? null;
    }

    if (updates.googleScholarId !== undefined) {
      setClauses.push('a.googleScholarId = $googleScholarId');
      params.googleScholarId = updates.googleScholarId ?? null;
    }

    if (updates.semanticScholarId !== undefined) {
      setClauses.push('a.semanticScholarId = $semanticScholarId');
      params.semanticScholarId = updates.semanticScholarId ?? null;
    }

    if (updates.bio !== undefined) {
      setClauses.push('a.bio = $bio');
      params.bio = updates.bio ?? null;
    }

    if (updates.website !== undefined) {
      setClauses.push('a.website = $website');
      params.website = updates.website ?? null;
    }

    const query = `
      MATCH (a:Author {did: $did})
      SET ${setClauses.join(', ')}
      RETURN a
    `;

    const result = await this.connection.executeQuery<{ a: Record<string, unknown> }>(
      query,
      params
    );

    if (result.records.length === 0) {
      throw new NotFoundError('Author', did);
    }
  }

  /**
   * Search authors by text.
   *
   * @param searchText - Search query
   * @param limit - Maximum results
   * @returns Search results
   */
  async searchAuthors(searchText: string, limit = 50): Promise<AuthorSearchResult> {
    // Try full-text search first
    const fullTextQuery = `
      CALL db.index.fulltext.queryNodes('authorTextIndex', $searchText)
      YIELD node, score
      WHERE node:Author
      WITH node AS a, score
      ORDER BY score DESC
      LIMIT $limit
      RETURN a
    `;

    try {
      const result = await this.connection.executeQuery<{ a: Record<string, unknown> }>(
        fullTextQuery,
        {
          searchText: `${searchText}*`,
          limit: neo4j.int(limit),
        }
      );

      const authors = result.records.map((record) => {
        const node = record.get('a');
        const props = (node.properties ?? node) as Record<string, string | number | Date | null>;
        return this.mapRecordToAuthor(props);
      });

      return {
        authors,
        total: authors.length,
      };
    } catch {
      // Fall back to CONTAINS if full-text index not available
      const fallbackQuery = `
        MATCH (a:Author)
        WHERE toLower(a.name) CONTAINS toLower($searchText)
           OR a.orcid = $searchText
        RETURN a
        ORDER BY a.name
        LIMIT $limit
      `;

      const result = await this.connection.executeQuery<{ a: Record<string, unknown> }>(
        fallbackQuery,
        {
          searchText,
          limit: neo4j.int(limit),
        }
      );

      const authors = result.records.map((record) => {
        const node = record.get('a');
        const props = (node.properties ?? node) as Record<string, string | number | Date | null>;
        return this.mapRecordToAuthor(props);
      });

      return {
        authors,
        total: authors.length,
      };
    }
  }

  /**
   * Get co-authors (collaborators) for an author.
   *
   * @param did - Author DID
   * @param limit - Maximum collaborators to return
   * @returns List of collaborators ordered by collaboration count
   */
  async getCollaborators(did: DID, limit = 20): Promise<Collaborator[]> {
    const query = `
      MATCH (author:Author {did: $did})-[r:COAUTHORED_WITH]-(collaborator:Author)
      WITH collaborator, count(r) AS collabCount
      ORDER BY collabCount DESC
      LIMIT $limit
      OPTIONAL MATCH (collaborator)-[:EXPERT_IN]->(field:Field)
      WITH collaborator, collabCount, collect(DISTINCT field.label) AS fields
      RETURN
        collaborator.did AS did,
        collaborator.name AS name,
        collaborator.orcid AS orcid,
        collabCount AS collaborationCount,
        fields
    `;

    const result = await this.connection.executeQuery<{
      did: DID;
      name: string;
      orcid: string | null;
      collaborationCount: number;
      fields: string[];
    }>(query, {
      did,
      limit: neo4j.int(limit),
    });

    return result.records.map((record) => ({
      did: record.get('did'),
      name: record.get('name'),
      orcid: record.get('orcid') ?? undefined,
      collaborationCount: Number(record.get('collaborationCount')),
      fields: record.get('fields'),
    }));
  }

  /**
   * Get expertise fields for an author.
   *
   * @param did - Author DID
   * @returns Field nodes the author is expert in
   */
  async getAuthorFields(did: DID): Promise<GraphNode[]> {
    const query = `
      MATCH (a:Author {did: $did})-[:EXPERT_IN]->(f:Node:Field)
      RETURN f
      ORDER BY f.label
    `;

    const result = await this.connection.executeQuery<{ f: Record<string, unknown> }>(query, {
      did,
    });

    return result.records.map((record) => {
      const node = record.get('f');
      const props = (node.properties ?? node) as Record<string, string | number | Date | null>;
      return this.mapRecordToNode(props, 'field');
    });
  }

  /**
   * Get external identifiers for an author.
   *
   * @param did - Author DID
   * @returns Array of external IDs with URLs
   */
  async getAuthorExternalIds(did: DID): Promise<AuthorExternalId[]> {
    const author = await this.getAuthor(did);
    if (!author) {
      return [];
    }

    const externalIds: AuthorExternalId[] = [];

    if (author.orcid) {
      externalIds.push({
        source: 'orcid',
        id: author.orcid,
        url: `https://orcid.org/${author.orcid}`,
      });
    }

    if (author.googleScholarId) {
      externalIds.push({
        source: 'googleScholar',
        id: author.googleScholarId,
        url: `https://scholar.google.com/citations?user=${author.googleScholarId}`,
      });
    }

    if (author.semanticScholarId) {
      externalIds.push({
        source: 'semanticScholar',
        id: author.semanticScholarId,
        url: `https://www.semanticscholar.org/author/${author.semanticScholarId}`,
      });
    }

    if (author.scopusId) {
      externalIds.push({
        source: 'scopus',
        id: author.scopusId,
        url: `https://www.scopus.com/authid/detail.uri?authorId=${author.scopusId}`,
      });
    }

    if (author.dblpId) {
      externalIds.push({
        source: 'dblp',
        id: author.dblpId,
        url: `https://dblp.org/pid/${author.dblpId}`,
      });
    }

    if (author.viafId) {
      externalIds.push({
        source: 'viaf',
        id: author.viafId,
        url: `https://viaf.org/viaf/${author.viafId}`,
      });
    }

    if (author.isni) {
      externalIds.push({
        source: 'isni',
        id: author.isni,
        url: `https://isni.org/isni/${author.isni.replace(/\s/g, '')}`,
      });
    }

    if (author.openAlexId) {
      externalIds.push({
        source: 'openAlex',
        id: author.openAlexId,
        url: `https://openalex.org/authors/${author.openAlexId}`,
      });
    }

    return externalIds;
  }

  /**
   * Get author's affiliations (institutions).
   *
   * @param did - Author DID
   * @returns Institution nodes the author is affiliated with
   */
  async getAuthorAffiliations(did: DID): Promise<GraphNode[]> {
    const query = `
      MATCH (a:Author {did: $did})-[:AFFILIATED_WITH]->(i:Node:Institution)
      RETURN i
      ORDER BY i.label
    `;

    const result = await this.connection.executeQuery<{ i: Record<string, unknown> }>(query, {
      did,
    });

    return result.records.map((record) => {
      const node = record.get('i');
      const props = (node.properties ?? node) as Record<
        string,
        string | number | Date | string[] | null
      >;
      return this.mapRecordToNode(props, 'institution');
    });
  }

  /**
   * Link author to expertise field.
   *
   * @param did - Author DID
   * @param fieldUri - Field URI
   */
  async linkAuthorToField(did: DID, fieldUri: AtUri): Promise<void> {
    const query = `
      MATCH (a:Author {did: $did})
      MATCH (f:Field {uri: $fieldUri})
      MERGE (a)-[:EXPERT_IN]->(f)
    `;

    await this.connection.executeQuery<Record<string, never>>(query, { did, fieldUri });
  }

  /**
   * Create co-authorship relationship.
   *
   * @param author1Did - First author DID
   * @param author2Did - Second author DID
   * @param eprintUri - URI of the eprint they co-authored
   */
  async createCoauthorship(author1Did: DID, author2Did: DID, eprintUri: AtUri): Promise<void> {
    const query = `
      MATCH (a1:Author {did: $author1Did})
      MATCH (a2:Author {did: $author2Did})
      WHERE a1 <> a2
      MERGE (a1)-[r:COAUTHORED_WITH]-(a2)
      ON CREATE SET r.eprints = [$eprintUri], r.count = 1, r.createdAt = datetime()
      ON MATCH SET r.eprints = CASE
        WHEN NOT $eprintUri IN r.eprints THEN r.eprints + [$eprintUri]
        ELSE r.eprints
      END,
      r.count = size(r.eprints)
    `;

    await this.connection.executeQuery<Record<string, never>>(query, {
      author1Did,
      author2Did,
      eprintUri,
    });
  }

  /**
   * Get paper count for an author.
   *
   * @param did - Author DID
   * @returns Number of papers authored
   */
  async getPaperCount(did: DID): Promise<number> {
    const query = `
      MATCH (a:Author {did: $did})-[:AUTHORED]->(e:Eprint)
      RETURN count(e) AS count
    `;

    const result = await this.connection.executeQuery<{ count: number }>(query, { did });
    const record = result.records[0];

    return record ? Number(record.get('count')) : 0;
  }

  /**
   * Map Neo4j node properties to AuthorNode.
   */
  private mapRecordToAuthor(node: Record<string, string | number | Date | null>): AuthorNode {
    const missing: string[] = [];
    if (!node.did) missing.push('did');
    if (!node.name) missing.push('name');
    if (!node.createdAt) missing.push('createdAt');

    if (missing.length > 0) {
      throw new DatabaseError(
        'READ',
        `Invalid author node: missing required properties: ${missing.join(', ')}`
      );
    }

    return {
      did: node.did as DID,
      name: node.name as string,
      orcid: node.orcid ? (node.orcid as string) : undefined,
      googleScholarId: node.googleScholarId ? (node.googleScholarId as string) : undefined,
      semanticScholarId: node.semanticScholarId ? (node.semanticScholarId as string) : undefined,
      scopusId: node.scopusId ? (node.scopusId as string) : undefined,
      dblpId: node.dblpId ? (node.dblpId as string) : undefined,
      viafId: node.viafId ? (node.viafId as string) : undefined,
      isni: node.isni ? (node.isni as string) : undefined,
      openAlexId: node.openAlexId ? (node.openAlexId as string) : undefined,
      bio: node.bio ? (node.bio as string) : undefined,
      website: node.website ? (node.website as string) : undefined,
      primaryAffiliationUri: node.primaryAffiliationUri
        ? (node.primaryAffiliationUri as AtUri)
        : undefined,
      createdAt: new Date(node.createdAt as string | Date),
      updatedAt: node.updatedAt ? new Date(node.updatedAt as string | Date) : undefined,
    };
  }

  /**
   * Map Neo4j node properties to GraphNode.
   */
  private mapRecordToNode(
    node: Record<string, string | number | Date | string[] | null>,
    subkind: string
  ): GraphNode {
    const missing: string[] = [];
    if (!node.id) missing.push('id');
    if (!node.uri) missing.push('uri');
    if (!node.label) missing.push('label');
    if (!node.createdAt) missing.push('createdAt');

    if (missing.length > 0) {
      throw new DatabaseError(
        'READ',
        `Invalid node: missing required properties: ${missing.join(', ')}`
      );
    }

    const metadata: NodeMetadata | undefined =
      node.country || node.city || node.website
        ? {
            country: node.country ? (node.country as string) : undefined,
            city: node.city ? (node.city as string) : undefined,
            website: node.website ? (node.website as string) : undefined,
            organizationStatus: node.organizationStatus
              ? (node.organizationStatus as 'active' | 'merged' | 'inactive' | 'defunct')
              : undefined,
          }
        : undefined;

    return {
      id: node.id as string,
      uri: node.uri as AtUri,
      kind: subkind === 'institution' ? 'object' : 'type',
      subkind,
      label: node.label as string,
      alternateLabels: Array.isArray(node.alternateLabels) ? node.alternateLabels : undefined,
      description: node.description ? (node.description as string) : undefined,
      metadata,
      status:
        (node.status as 'proposed' | 'provisional' | 'established' | 'deprecated') ?? 'established',
      createdAt: new Date(node.createdAt as string | Date),
      createdBy: node.createdBy ? (node.createdBy as DID) : undefined,
      updatedAt: node.updatedAt ? new Date(node.updatedAt as string | Date) : undefined,
    };
  }
}
