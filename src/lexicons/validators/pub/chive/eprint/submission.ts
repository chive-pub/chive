/**
 * Zod validator for pub.chive.eprint.submission
 *
 * @remarks
 * Generated from Lexicon schema. DO NOT EDIT manually.
 * Regenerate using: pnpm lexicons:generate
 *
 * @packageDocumentation
 * @internal
 */

import { z } from 'zod';
import { eprintAuthorContributionSchema } from './authorContribution.js';
import { graphFacetSchema } from '../graph/facet.js';

/**
 * Zod schema for pub.chive.eprint.submission record.
 *
 * @internal
 */
export const eprintSubmissionSchema = z.object({
  title: z.string().max(500),
  abstract: z.string().max(5000),
  document: z.object({ $type: z.literal("blob"), ref: z.object({ $link: z.string() }), mimeType: z.string(), size: z.number() }),
  documentFormat: z.enum(["pdf", "docx", "html", "markdown", "latex", "jupyter", "odt", "rtf", "epub", "txt"]).optional(),
  supplementaryMaterials: z.array(z.object({ blob: z.object({ $type: z.literal("blob"), ref: z.object({ $link: z.string() }), mimeType: z.string(), size: z.number() }), label: z.string().max(200), description: z.string().max(1000).optional(), category: z.enum(["appendix", "figure", "table", "dataset", "code", "notebook", "video", "audio", "presentation", "protocol", "questionnaire", "other"]).optional(), detectedFormat: z.string().optional(), order: z.number().int().min(1).optional() })).max(50).optional(),
  authors: z.array(eprintAuthorContributionSchema).min(1).max(100),
  submittedBy: z.string().refine((val) => /^did:[a-z]+:[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid DID format" }),
  paperDid: z.string().refine((val) => /^did:[a-z]+:[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid DID format" }).optional(),
  keywords: z.array(z.string().max(100)).max(20).optional(),
  facets: z.array(graphFacetSchema).max(30).optional(),
  version: z.number().int().min(1).optional(),
  previousVersion: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }).optional(),
  license: z.enum(["CC-BY-4.0", "CC-BY-SA-4.0", "CC0-1.0", "MIT", "Apache-2.0"]),
  publicationStatus: z.enum(["preprint", "under_review", "revision_requested", "accepted", "in_press", "published", "retracted"]).optional(),
  publishedVersion: z.object({ doi: z.string().optional(), url: z.string().optional(), publishedAt: z.string().datetime().optional(), journal: z.string().max(500).optional(), journalAbbreviation: z.string().max(100).optional(), journalIssn: z.string().optional(), publisher: z.string().max(300).optional(), volume: z.string().max(50).optional(), issue: z.string().max(50).optional(), pages: z.string().max(50).optional(), articleNumber: z.string().max(50).optional(), eLocationId: z.string().optional(), accessType: z.enum(["open_access", "green_oa", "gold_oa", "hybrid_oa", "bronze_oa", "closed"]).optional(), licenseUrl: z.string().optional() }).optional(),
  relatedWorks: z.array(z.object({ identifier: z.string(), identifierType: z.enum(["doi", "arxiv", "pmid", "pmcid", "url", "urn", "handle", "isbn", "issn", "at-uri"]), relationType: z.enum(["isPreprintOf", "hasPreprint", "isVersionOf", "hasVersion", "isNewVersionOf", "isPreviousVersionOf", "isPartOf", "hasPart", "references", "isReferencedBy", "isSupplementTo", "isSupplementedBy", "isContinuedBy", "continues", "isDocumentedBy", "documents", "isCompiledBy", "compiles", "isVariantFormOf", "isOriginalFormOf", "isIdenticalTo", "isReviewedBy", "reviews", "isDerivedFrom", "isSourceOf", "isRequiredBy", "requires", "isObsoletedBy", "obsoletes"]), title: z.string().optional(), description: z.string().optional() })).max(50).optional(),
  externalIds: z.object({ arxivId: z.string().optional(), pmid: z.string().optional(), pmcid: z.string().optional(), ssrnId: z.string().optional(), osf: z.string().optional(), zenodoDoi: z.string().optional(), openAlexId: z.string().optional(), semanticScholarId: z.string().optional(), coreSid: z.string().optional(), magId: z.string().optional() }).optional(),
  repositories: z.object({ code: z.array(z.object({ url: z.string().optional(), platform: z.enum(["github", "gitlab", "bitbucket", "codeberg", "sourcehut", "software_heritage", "other"]).optional(), label: z.string().optional(), archiveUrl: z.string().optional(), swhid: z.string().optional() })).max(10).optional(), data: z.array(z.object({ url: z.string().optional(), doi: z.string().optional(), platform: z.enum(["zenodo", "figshare", "dryad", "osf", "dataverse", "mendeley_data", "other"]).optional(), label: z.string().optional(), accessStatement: z.string().optional() })).max(20).optional(), preregistration: z.object({ url: z.string().optional(), platform: z.enum(["osf", "aspredicted", "clinicaltrials", "prospero", "other"]).optional(), registrationDate: z.string().datetime().optional() }).optional(), protocols: z.array(z.object({ url: z.string().optional(), doi: z.string().optional(), platform: z.enum(["protocols_io", "bio_protocol", "other"]).optional() })).max(10).optional(), materials: z.array(z.object({ url: z.string().optional(), rrid: z.string().optional(), label: z.string().optional() })).max(20).optional() }).optional(),
  funding: z.array(z.object({ funderName: z.string().max(300).optional(), funderDoi: z.string().optional(), funderRor: z.string().optional(), grantNumber: z.string().max(100).optional(), grantTitle: z.string().max(500).optional(), grantUrl: z.string().optional() })).max(20).optional(),
  conferencePresentation: z.object({ conferenceName: z.string().max(500).optional(), conferenceAcronym: z.string().max(50).optional(), conferenceUrl: z.string().optional(), conferenceLocation: z.string().optional(), presentationDate: z.string().datetime().optional(), presentationType: z.enum(["oral", "poster", "keynote", "workshop", "demo", "other"]).optional(), proceedingsDoi: z.string().optional() }).optional(),
  createdAt: z.string().datetime(),
});

/**
 * Type for pub.chive.eprint.submission record.
 *
 * @public
 */
export type EprintSubmission = z.infer<typeof eprintSubmissionSchema>;


