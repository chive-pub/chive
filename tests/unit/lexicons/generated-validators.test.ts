/**
 * Unit tests for generated Zod validators
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';

import { actorProfileSchema } from '@/lexicons/validators/pub/chive/actor/profile.js';
import {
  eprintGetSubmissionParamsSchema,
  eprintGetSubmissionOutputSchema,
} from '@/lexicons/validators/pub/chive/eprint/getSubmission.js';
import { eprintSearchSubmissionsParamsSchema } from '@/lexicons/validators/pub/chive/eprint/searchSubmissions.js';
import { eprintSubmissionSchema } from '@/lexicons/validators/pub/chive/eprint/submission.js';
import { eprintUserTagSchema } from '@/lexicons/validators/pub/chive/eprint/userTag.js';
import { eprintVersionSchema } from '@/lexicons/validators/pub/chive/eprint/version.js';
import { graphFieldProposalSchema } from '@/lexicons/validators/pub/chive/graph/fieldProposal.js';
import { graphVoteSchema } from '@/lexicons/validators/pub/chive/graph/vote.js';
import { reviewCommentSchema } from '@/lexicons/validators/pub/chive/review/comment.js';
import { reviewEndorsementSchema } from '@/lexicons/validators/pub/chive/review/endorsement.js';

describe('Generated Zod Validators', () => {
  // Helper function to create valid eprint base data
  function createValidEprintBase(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      title: 'Test Eprint',
      abstract: 'Test abstract',
      document: {
        $type: 'blob',
        ref: {
          $link: 'bafyreibwkjvc2wlkqn3v6jxlp2w3z4',
        },
        mimeType: 'application/pdf',
        size: 1000,
      },
      authors: [
        {
          name: 'Test Author',
          order: 1,
          affiliations: [{ name: 'University' }],
          contributions: [],
          isCorrespondingAuthor: true,
          isHighlighted: false,
        },
      ],
      submittedBy: 'did:plc:abc123',
      license: 'CC-BY-4.0',
      createdAt: new Date().toISOString(),
      ...overrides,
    };
  }

  describe('eprintSubmissionSchema', () => {
    it('validates valid eprint', () => {
      const valid = createValidEprintBase({
        title: 'Quantum Entanglement in Photonic Systems',
        abstract: 'We demonstrate quantum entanglement in photonic systems.',
        keywords: ['quantum', 'photonics'],
      });

      expect(() => eprintSubmissionSchema.parse(valid)).not.toThrow();
    });

    it('rejects eprint missing required fields', () => {
      const invalid = {
        title: 'Test',
        // Missing abstract, document, authors, submittedBy, license, createdAt
      };

      expect(() => eprintSubmissionSchema.parse(invalid)).toThrow();
    });

    it('enforces title max length (500)', () => {
      const tooLong = createValidEprintBase({
        title: 'a'.repeat(501),
      });

      expect(() => eprintSubmissionSchema.parse(tooLong)).toThrow();
    });

    it('enforces abstract max length (5000)', () => {
      const tooLong = createValidEprintBase({
        abstract: 'a'.repeat(5001),
      });

      expect(() => eprintSubmissionSchema.parse(tooLong)).toThrow();
    });

    it('validates license enum values', () => {
      const validLicenses = ['CC-BY-4.0', 'CC-BY-SA-4.0', 'CC0-1.0', 'MIT', 'Apache-2.0'];

      for (const license of validLicenses) {
        const data = createValidEprintBase({ license });
        expect(() => eprintSubmissionSchema.parse(data)).not.toThrow();
      }
    });

    it('rejects invalid license value', () => {
      const invalid = createValidEprintBase({
        license: 'INVALID-LICENSE',
      });

      expect(() => eprintSubmissionSchema.parse(invalid)).toThrow();
    });

    it('validates multiple authors', () => {
      const valid = createValidEprintBase({
        authors: [
          {
            did: 'did:plc:abc123',
            name: 'Test Author 1',
            order: 1,
            affiliations: [{ name: 'University' }],
            contributions: [],
            isCorrespondingAuthor: true,
            isHighlighted: false,
          },
          {
            did: 'did:web:example.com',
            name: 'Test Author 2',
            order: 2,
            affiliations: [],
            contributions: [],
            isCorrespondingAuthor: false,
            isHighlighted: false,
          },
        ],
      });

      expect(() => eprintSubmissionSchema.parse(valid)).not.toThrow();
    });

    it('validates AT URI format for previousVersion', () => {
      const valid = createValidEprintBase({
        previousVersion: 'at://did:plc:abc123/pub.chive.eprint.submission/xyz789',
      });

      expect(() => eprintSubmissionSchema.parse(valid)).not.toThrow();
    });

    it('enforces keywords array max length (20)', () => {
      const tooMany = createValidEprintBase({
        keywords: Array(21).fill('keyword'),
      });

      expect(() => eprintSubmissionSchema.parse(tooMany)).toThrow();
    });
  });

  describe('reviewCommentSchema', () => {
    it('validates valid comment', () => {
      const valid = {
        eprintUri: 'at://did:plc:abc123/pub.chive.eprint.submission/xyz789',
        content: 'Excellent methodology!',
        createdAt: new Date().toISOString(),
      };

      expect(() => reviewCommentSchema.parse(valid)).not.toThrow();
    });

    it('validates comment with optional lineNumber', () => {
      const valid = {
        eprintUri: 'at://did:plc:abc123/pub.chive.eprint.submission/xyz789',
        content: 'This line needs clarification.',
        lineNumber: 42,
        createdAt: new Date().toISOString(),
      };

      expect(() => reviewCommentSchema.parse(valid)).not.toThrow();
    });

    it('validates comment with parentComment', () => {
      const valid = {
        eprintUri: 'at://did:plc:abc123/pub.chive.eprint.submission/xyz789',
        content: 'I agree with the above comment.',
        parentComment: 'at://did:plc:abc123/pub.chive.review.comment/parent123',
        createdAt: new Date().toISOString(),
      };

      expect(() => reviewCommentSchema.parse(valid)).not.toThrow();
    });

    it('enforces content max length (10000)', () => {
      const tooLong = {
        eprintUri: 'at://did:plc:abc123/pub.chive.eprint.submission/xyz789',
        content: 'a'.repeat(10001),
        createdAt: new Date().toISOString(),
      };

      expect(() => reviewCommentSchema.parse(tooLong)).toThrow();
    });

    it('validates AT URI format for eprintUri', () => {
      const valid = {
        eprintUri: 'at://did:plc:abc123/pub.chive.eprint.submission/xyz789',
        content: 'Great work!',
        createdAt: new Date().toISOString(),
      };

      expect(() => reviewCommentSchema.parse(valid)).not.toThrow();
    });
  });

  describe('reviewEndorsementSchema', () => {
    it('validates valid endorsement', () => {
      const valid = {
        eprintUri: 'at://did:plc:abc123/pub.chive.eprint.submission/xyz789',
        contributions: ['methodological'],
        createdAt: new Date().toISOString(),
      };

      expect(() => reviewEndorsementSchema.parse(valid)).not.toThrow();
    });

    it('validates all contribution types', () => {
      const contributionTypes = [
        'methodological',
        'analytical',
        'theoretical',
        'empirical',
        'conceptual',
        'technical',
        'data',
        'replication',
        'reproducibility',
        'synthesis',
        'interdisciplinary',
        'pedagogical',
        'visualization',
        'societal-impact',
        'clinical',
      ];

      for (const contribution of contributionTypes) {
        const data = {
          eprintUri: 'at://did:plc:abc123/pub.chive.eprint.submission/xyz789',
          contributions: [contribution],
          createdAt: new Date().toISOString(),
        };

        expect(() => reviewEndorsementSchema.parse(data)).not.toThrow();
      }
    });

    it('validates endorsement with multiple contributions', () => {
      const valid = {
        eprintUri: 'at://did:plc:abc123/pub.chive.eprint.submission/xyz789',
        contributions: ['methodological', 'analytical', 'data'],
        createdAt: new Date().toISOString(),
      };

      expect(() => reviewEndorsementSchema.parse(valid)).not.toThrow();
    });

    it('rejects empty contributions array', () => {
      const invalid = {
        eprintUri: 'at://did:plc:abc123/pub.chive.eprint.submission/xyz789',
        contributions: [],
        createdAt: new Date().toISOString(),
      };

      expect(() => reviewEndorsementSchema.parse(invalid)).toThrow();
    });

    it('validates endorsement with optional comment', () => {
      const valid = {
        eprintUri: 'at://did:plc:abc123/pub.chive.eprint.submission/xyz789',
        contributions: ['synthesis', 'interdisciplinary'],
        comment: 'Comprehensive and well-designed study.',
        createdAt: new Date().toISOString(),
      };

      expect(() => reviewEndorsementSchema.parse(valid)).not.toThrow();
    });
  });

  describe('graphFieldProposalSchema', () => {
    it('validates valid field proposal', () => {
      const valid = {
        proposalType: 'create',
        proposedLabel: 'Quantum Computing',
        rationale: 'Rapidly growing field',
        createdAt: new Date().toISOString(),
      };

      expect(() => graphFieldProposalSchema.parse(valid)).not.toThrow();
    });

    it('validates all proposal types', () => {
      const types = ['create', 'update', 'merge', 'delete'];

      for (const proposalType of types) {
        const data = {
          proposalType,
          rationale: 'Justification',
          createdAt: new Date().toISOString(),
        };

        expect(() => graphFieldProposalSchema.parse(data)).not.toThrow();
      }
    });

    it('validates proposal with all optional fields', () => {
      const valid = {
        fieldId: 'field-123',
        proposalType: 'update',
        proposedLabel: 'Updated Label',
        proposedDescription: 'Updated description',
        wikidataId: 'Q12345',
        rationale: 'Needs updating',
        createdAt: new Date().toISOString(),
      };

      expect(() => graphFieldProposalSchema.parse(valid)).not.toThrow();
    });
  });

  describe('graphVoteSchema', () => {
    it('validates valid vote', () => {
      const valid = {
        proposalUri: 'at://did:plc:abc123/pub.chive.graph.fieldproposal/xyz789',
        vote: 'approve',
        createdAt: new Date().toISOString(),
      };

      expect(() => graphVoteSchema.parse(valid)).not.toThrow();
    });

    it('validates both vote types', () => {
      const votes = ['approve', 'reject'];

      for (const vote of votes) {
        const data = {
          proposalUri: 'at://did:plc:abc123/pub.chive.graph.fieldproposal/xyz789',
          vote,
          createdAt: new Date().toISOString(),
        };

        expect(() => graphVoteSchema.parse(data)).not.toThrow();
      }
    });

    it('validates AT URI format for proposalUri', () => {
      const valid = {
        proposalUri: 'at://did:plc:abc123/pub.chive.graph.fieldproposal/xyz789',
        vote: 'approve',
        createdAt: new Date().toISOString(),
      };

      expect(() => graphVoteSchema.parse(valid)).not.toThrow();
    });
  });

  describe('eprintVersionSchema', () => {
    it('validates valid version', () => {
      const valid = {
        eprintUri: 'at://did:plc:abc123/pub.chive.eprint.submission/xyz789',
        versionNumber: 2,
        changes: 'Updated methodology section',
        createdAt: new Date().toISOString(),
      };

      expect(() => eprintVersionSchema.parse(valid)).not.toThrow();
    });

    it('enforces versionNumber minimum (1)', () => {
      const invalid = {
        eprintUri: 'at://did:plc:abc123/pub.chive.eprint.submission/xyz789',
        versionNumber: 0,
        changes: 'Changes',
        createdAt: new Date().toISOString(),
      };

      expect(() => eprintVersionSchema.parse(invalid)).toThrow();
    });
  });

  describe('eprintUserTagSchema', () => {
    it('validates valid user tag', () => {
      const valid = {
        eprintUri: 'at://did:plc:abc123/pub.chive.eprint.submission/xyz789',
        tag: 'machine-learning',
        createdAt: new Date().toISOString(),
      };

      expect(() => eprintUserTagSchema.parse(valid)).not.toThrow();
    });

    it('enforces tag max length (100)', () => {
      const tooLong = {
        eprintUri: 'at://did:plc:abc123/pub.chive.eprint.submission/xyz789',
        tag: 'a'.repeat(101),
        createdAt: new Date().toISOString(),
      };

      expect(() => eprintUserTagSchema.parse(tooLong)).toThrow();
    });
  });

  describe('actorProfileSchema', () => {
    it('validates minimal profile', () => {
      const valid = {};

      expect(() => actorProfileSchema.parse(valid)).not.toThrow();
    });

    it('validates profile with all fields', () => {
      const valid = {
        displayName: 'Dr. Jane Smith',
        bio: 'Quantum physicist',
        avatar: {
          $type: 'blob',
          ref: {
            $link: 'bafyreibwkjvc2wlkqn3v6jxlp2w3z4',
          },
          mimeType: 'image/jpeg',
          size: 50000,
        },
        orcid: '0000-0002-1825-0097',
        affiliations: [{ name: 'MIT' }, { name: 'CERN', rorId: 'https://ror.org/01swzsf04' }],
        fields: ['quantum-physics'],
      };

      expect(() => actorProfileSchema.parse(valid)).not.toThrow();
    });
  });

  describe('XRPC Query Schemas', () => {
    it('validates getSubmission parameters', () => {
      const valid = {
        uri: 'at://did:plc:abc123/pub.chive.eprint.submission/xyz789',
        cid: 'bafyreibwkjvc2wlkqn3v6jxlp2w3z4',
      };

      expect(() => eprintGetSubmissionParamsSchema.parse(valid)).not.toThrow();
    });

    it('validates getSubmission output', () => {
      const valid = {
        uri: 'at://did:plc:abc123/pub.chive.eprint.submission/xyz789',
        cid: 'bafyreibwkjvc2wlkqn3v6jxlp2w3z4',
        value: {
          title: 'Test Eprint',
          abstract: 'This is a test abstract',
          document: {
            $type: 'blob',
            ref: {
              $link: 'bafkreihgv2crvahfy7lp2o7q7igdv3kd7eaeyyfuwepqwvr24bxq6vhgcy',
            },
            mimeType: 'application/pdf',
            size: 1024000,
          },
          authors: [
            {
              name: 'Test Author',
              order: 1,
              affiliations: [{ name: 'University' }],
              contributions: [],
              isCorrespondingAuthor: true,
              isHighlighted: false,
            },
          ],
          submittedBy: 'did:plc:abc123',
          license: 'CC-BY-4.0',
          createdAt: new Date().toISOString(),
        },
        indexedAt: new Date().toISOString(),
        pdsUrl: 'https://pds.example.com',
      };

      expect(() => eprintGetSubmissionOutputSchema.parse(valid)).not.toThrow();
    });

    it('validates searchSubmissions parameters', () => {
      const valid = {
        q: 'quantum computing',
        author: 'did:plc:abc123',
        limit: 25,
      };

      expect(() => eprintSearchSubmissionsParamsSchema.parse(valid)).not.toThrow();
    });

    it('rejects searchSubmissions without required q', () => {
      const invalid = {
        author: 'did:plc:abc123',
      };

      expect(() => eprintSearchSubmissionsParamsSchema.parse(invalid)).toThrow();
    });
  });
});
