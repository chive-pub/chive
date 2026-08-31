/**
 * Reads a researcher's sifa.id profile from their own repository.
 *
 * @remarks
 * sifa.id (`did:plc:2f2ahswozqy4v5lvu676375y`) is an ATProto professional
 * profile service. Its records live in each user's own repository under the
 * `id.sifa.*` namespace, which means Chive can read a researcher's positions
 * and education straight from their PDS — the same place it already reads their
 * eprints from — without either service holding an account with the other.
 *
 * The mapping Chive cares about:
 *
 * - `id.sifa.profile.position` is employment. A position with no `endedAt` is a
 *   current affiliation; one with an `endedAt` is a previous affiliation. This
 *   is exactly the current/previous split Chive's profile already has, so a
 *   researcher who maintains a sifa profile need not retype it here.
 * - `id.sifa.profile.education` is study, which for academics is very often how
 *   a previous affiliation is expressed — a PhD institution is an affiliation
 *   older papers carry.
 * - `id.sifa.profile.self` carries the display name, headline and pronouns.
 *
 * **ATProto compliance.** This reads from user repositories and writes nothing.
 * Chive never creates `id.sifa.*` records on a user's behalf; where a user
 * chooses to publish one — a publication record pointing back at their eprint —
 * their own client writes it to their own repository.
 *
 * Nothing here is a source of truth. A researcher with no sifa profile is the
 * normal case and yields an empty result, not an error.
 *
 * @packageDocumentation
 */

import type { NSID } from '../../types/atproto.js';
import type { DID } from '../../types/atproto.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { IRepository } from '../../types/interfaces/repository.interface.js';
import type { Affiliation } from '../../types/models/author.js';

/**
 * DID that publishes the `id.sifa.*` lexicons.
 *
 * @remarks
 * Confirmed against the `_lexicon.sifa.id` DNS TXT record, which is how an
 * authority names its lexicon publisher.
 *
 * @public
 */
export const SIFA_PUBLISHER_DID = 'did:plc:2f2ahswozqy4v5lvu676375y';

/**
 * Collections this service reads.
 *
 * @public
 */
export const SIFA_COLLECTIONS = {
  self: 'id.sifa.profile.self',
  position: 'id.sifa.profile.position',
  education: 'id.sifa.profile.education',
} as const;

/**
 * An `id.sifa.profile.position` record.
 *
 * @internal
 */
interface SifaPosition {
  title?: string;
  company?: string;
  companyDid?: string;
  startedAt?: string;
  endedAt?: string;
  isPrimary?: boolean;
  employmentType?: string;
}

/**
 * An `id.sifa.profile.education` record.
 *
 * @internal
 */
interface SifaEducation {
  institution?: string;
  institutionDid?: string;
  degree?: string;
  fieldOfStudy?: string;
  startedAt?: string;
  endedAt?: string;
}

/**
 * An `id.sifa.profile.self` record.
 *
 * @internal
 */
interface SifaSelf {
  displayName?: string;
  givenName?: string;
  familyName?: string;
  headline?: string;
  about?: string;
  pronouns?: string;
}

/**
 * A role held at an institution, as sifa records it.
 *
 * @public
 */
export interface SifaRole {
  /** Institution or employer name */
  readonly institution: string;
  /** Job title or degree */
  readonly title?: string;
  /** The institution's own DID, when sifa records one */
  readonly institutionDid?: string;
  /** ISO date the role began */
  readonly startedAt?: string;
  /** ISO date the role ended; absent means current */
  readonly endedAt?: string;
  /** Whether sifa marks this the primary position */
  readonly isPrimary?: boolean;
  /** Which sifa collection this came from */
  readonly source: 'position' | 'education';
}

/**
 * A researcher's sifa profile, in the terms Chive uses.
 *
 * @public
 */
export interface SifaProfile {
  /** Whether the researcher has any sifa records at all */
  readonly hasProfile: boolean;
  /** Display name from `id.sifa.profile.self` */
  readonly displayName?: string;
  /** Headline, a one-line description of what they do */
  readonly headline?: string;
  /** Longer self-description */
  readonly about?: string;
  /** Pronouns, as the researcher states them */
  readonly pronouns?: string;
  /** Roles with no end date */
  readonly currentRoles: readonly SifaRole[];
  /** Roles with an end date, most recently ended first */
  readonly previousRoles: readonly SifaRole[];
}

/**
 * Maximum records read per collection.
 *
 * @remarks
 * A profile with more than this many positions is not a profile Chive can
 * usefully display, and the cap bounds what an unbounded repository can cost.
 */
const MAX_RECORDS = 100;

/**
 * Reads sifa.id profile records from user repositories.
 *
 * @public
 */
export class SifaProfileService {
  /**
   * Creates the service.
   *
   * @param repository - Repository reader, which resolves the DID's PDS
   * @param logger - Logger
   */
  constructor(
    private readonly repository: IRepository,
    private readonly logger: ILogger
  ) {}

  /**
   * Reads a researcher's sifa profile.
   *
   * @param did - The researcher's DID
   * @returns Their sifa profile, empty when they have none
   *
   * @remarks
   * Never throws. A researcher without a sifa profile, an unreachable PDS and a
   * repository that refuses the collection are all the same thing from Chive's
   * side: no sifa data to show. Failing the whole author profile because an
   * optional enrichment was unavailable would be the wrong trade.
   */
  async getProfile(did: DID): Promise<SifaProfile> {
    const [self, positions, education] = await Promise.all([
      this.readOne<SifaSelf>(did, SIFA_COLLECTIONS.self),
      this.readAll<SifaPosition>(did, SIFA_COLLECTIONS.position),
      this.readAll<SifaEducation>(did, SIFA_COLLECTIONS.education),
    ]);

    const roles: SifaRole[] = [
      ...positions.flatMap((p) => (p.company ? [positionToRole(p)] : [])),
      ...education.flatMap((e) => (e.institution ? [educationToRole(e)] : [])),
    ];

    const currentRoles = roles
      .filter((r) => !r.endedAt)
      // sifa's own primary flag decides which affiliation leads; failing that,
      // the most recently started role is the best guess at the main one.
      .sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary === true ? -1 : 1;
        return (b.startedAt ?? '').localeCompare(a.startedAt ?? '');
      });

    const previousRoles = roles
      .filter((r) => r.endedAt)
      .sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''));

    const displayName =
      self?.displayName ??
      [self?.givenName, self?.familyName].filter(Boolean).join(' ').trim() ??
      undefined;

    return {
      hasProfile: self !== null || roles.length > 0,
      ...(displayName ? { displayName } : {}),
      ...(self?.headline ? { headline: self.headline } : {}),
      ...(self?.about ? { about: self.about } : {}),
      ...(self?.pronouns ? { pronouns: self.pronouns } : {}),
      currentRoles,
      previousRoles,
    };
  }

  /**
   * Converts sifa roles into Chive affiliations.
   *
   * @param roles - Roles from {@link SifaProfile}
   * @returns Affiliations, deduplicated by institution
   *
   * @remarks
   * Chive's `Affiliation` is a tree: an institution with sub-units beneath it.
   * sifa records a flat institution plus a job title, and a title is not a
   * sub-unit — "Associate Professor" is not a department — so titles are not
   * turned into children. Two roles at the same institution therefore collapse
   * to one affiliation rather than duplicating it.
   *
   * @public
   */
  toAffiliations(roles: readonly SifaRole[]): Affiliation[] {
    const byInstitution = new Map<string, Affiliation>();

    for (const role of roles) {
      if (!byInstitution.has(role.institution)) {
        byInstitution.set(role.institution, { name: role.institution });
      }
    }

    return [...byInstitution.values()];
  }

  /**
   * Reads every record in a collection, up to {@link MAX_RECORDS}.
   */
  private async readAll<T>(did: DID, collection: string): Promise<T[]> {
    const values: T[] = [];

    try {
      for await (const record of this.repository.listRecords<T>(did, collection as NSID)) {
        values.push(record.value);
        if (values.length >= MAX_RECORDS) {
          break;
        }
      }
    } catch (error) {
      this.logger.debug('No sifa records read', {
        did,
        collection,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return values;
  }

  /**
   * Reads the single record in a `literal:self`-keyed collection.
   */
  private async readOne<T>(did: DID, collection: string): Promise<T | null> {
    const [first] = await this.readAll<T>(did, collection);
    return first ?? null;
  }
}

/**
 * Maps an employment record to a role.
 */
function positionToRole(position: SifaPosition): SifaRole {
  return {
    institution: position.company ?? '',
    ...(position.title ? { title: position.title } : {}),
    ...(position.companyDid ? { institutionDid: position.companyDid } : {}),
    ...(position.startedAt ? { startedAt: position.startedAt } : {}),
    ...(position.endedAt ? { endedAt: position.endedAt } : {}),
    ...(position.isPrimary === true ? { isPrimary: true } : {}),
    source: 'position',
  };
}

/**
 * Maps an education record to a role.
 *
 * @remarks
 * The degree stands in for a job title: "PhD, Linguistics" is what a reader
 * wants to see beside the institution.
 */
function educationToRole(education: SifaEducation): SifaRole {
  const title = [education.degree, education.fieldOfStudy].filter(Boolean).join(', ');

  return {
    institution: education.institution ?? '',
    ...(title ? { title } : {}),
    ...(education.institutionDid ? { institutionDid: education.institutionDid } : {}),
    ...(education.startedAt ? { startedAt: education.startedAt } : {}),
    ...(education.endedAt ? { endedAt: education.endedAt } : {}),
    source: 'education',
  };
}
