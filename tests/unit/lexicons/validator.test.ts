/**
 * Unit tests for LexiconValidator
 *
 * @packageDocumentation
 */

import path from 'path';
import { fileURLToPath } from 'url';

import { jsonToLex } from '@atproto/lexicon';
import { describe, it, expect, beforeAll } from 'vitest';

import { LexiconValidator } from '@/lexicons/validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('LexiconValidator', () => {
  let validator: LexiconValidator;

  beforeAll(async () => {
    validator = new LexiconValidator();
    const lexiconsDir = path.join(__dirname, '../../../lexicons');
    await validator.loadSchemas(lexiconsDir);
  });

  describe('Schema Loading', () => {
    it('loads all schemas from directory', async () => {
      const freshValidator = new LexiconValidator();
      const lexiconsDir = path.join(__dirname, '../../../lexicons');
      await expect(freshValidator.loadSchemas(lexiconsDir)).resolves.not.toThrow();
    });

    it('throws error when schema file cannot be read', async () => {
      const invalidValidator = new LexiconValidator();
      await expect(invalidValidator.loadSchemas('/nonexistent/path')).rejects.toThrow();
    });
  });

  describe('Record Validation', () => {
    it('validates valid eprint submission', () => {
      const validEprintJson = {
        $type: 'pub.chive.eprint.submission',
        title: 'Frequency, acceptability, and selection: A case study of clause-embedding',
        abstract: [
          {
            $type: 'pub.chive.eprint.submission#textItem',
            type: 'text',
            content:
              'We investigate the relationship between distributional frequency and acceptability for clause-embedding verbs using the MegaAcceptability dataset.',
          },
        ],
        abstractPlainText:
          'We investigate the relationship between distributional frequency and acceptability for clause-embedding verbs using the MegaAcceptability dataset.',
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
            did: 'did:plc:abc123',
            name: 'Jane Smith',
            order: 1,
            affiliations: [{ name: 'University of Example' }],
            contributions: [],
            isCorrespondingAuthor: true,
            isHighlighted: false,
          },
        ],
        submittedBy: 'did:plc:abc123',
        licenseSlug: 'CC-BY-4.0',
        createdAt: new Date().toISOString(),
      };

      // Convert JSON format (with $link) to Lexicon format (with BlobRef instances)
      const validEprint = jsonToLex(validEprintJson);

      const result = validator.validateRecord('pub.chive.eprint.submission', validEprint);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects eprint with missing required fields', () => {
      const invalidEprint = {
        title: 'Missing Required Fields',
        // Missing abstract, pdf, license, createdAt
      };

      const result = validator.validateRecord('pub.chive.eprint.submission', invalidEprint);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('validates review comment with all fields', () => {
      const validComment = {
        $type: 'pub.chive.review.comment',
        eprintUri: 'at://did:plc:abc123/pub.chive.eprint.submission/abc123',
        body: [
          {
            $type: 'pub.chive.review.comment#textItem',
            type: 'text',
            content:
              'The analysis of factive predicates is particularly compelling. Consider extending to non-factive belief verbs.',
          },
        ],
        motivationFallback: 'commenting',
        createdAt: new Date().toISOString(),
      };

      const result = validator.validateRecord('pub.chive.review.comment', validComment);
      expect(result.valid).toBe(true);
    });

    it('validates review comment without optional fields', () => {
      const validComment = {
        $type: 'pub.chive.review.comment',
        eprintUri: 'at://did:plc:abc123/pub.chive.eprint.submission/abc123',
        body: [
          {
            $type: 'pub.chive.review.comment#textItem',
            type: 'text',
            content: 'Well-motivated theoretical framework for semantic selection.',
          },
        ],
        createdAt: new Date().toISOString(),
      };

      const result = validator.validateRecord('pub.chive.review.comment', validComment);
      expect(result.valid).toBe(true);
    });

    it('validates actor profile with optional ORCID', () => {
      const validProfile = {
        $type: 'pub.chive.actor.profile',
        displayName: 'Aaron Steven White',
        bio: 'Computational linguist specializing in clause-embedding verbs and lexical semantics.',
        orcid: '0000-0003-0057-9246',
        affiliations: [{ name: 'University of Rochester' }],
        fields: ['computational-semantics', 'formal-semantics'],
      };

      const result = validator.validateRecord('pub.chive.actor.profile', validProfile);
      expect(result.valid).toBe(true);
    });

    it('validates node proposal', () => {
      const validProposal = {
        $type: 'pub.chive.graph.nodeProposal',
        proposalType: 'create',
        kind: 'type',
        subkind: 'field',
        proposedNode: {
          label: 'Dynamic Semantics',
          description: 'Field covering dynamic approaches to natural language meaning',
          externalIds: [{ system: 'wikidata', identifier: 'Q5318053' }],
        },
        rationale: 'Distinct subfield of formal semantics with active research community.',
        createdAt: new Date().toISOString(),
      };

      const result = validator.validateRecord('pub.chive.graph.nodeProposal', validProposal);
      expect(result.valid).toBe(true);
    });

    it('validates vote on proposal', () => {
      const validVote = {
        $type: 'pub.chive.graph.vote',
        proposalUri: 'at://did:plc:abc123/pub.chive.graph.fieldProposal/xyz789',
        vote: 'approve',
        comment: 'Good proposal, well justified.',
        createdAt: new Date().toISOString(),
      };

      const result = validator.validateRecord('pub.chive.graph.vote', validVote);
      expect(result.valid).toBe(true);
    });
  });

  describe('XRPC Parameter Validation', () => {
    it('validates getSubmission query parameters', () => {
      const validParams = {
        uri: 'at://did:plc:abc123/pub.chive.eprint.submission/abc123',
        cid: 'bafkreihgv2crvahfy7lp2o7q7igdv3kd7eaeyyfuwepqwvr24bxq6vhgcy',
      };

      const result = validator.validateParams('pub.chive.eprint.getSubmission', validParams);
      expect(result.valid).toBe(true);
    });

    it('validates getSubmission parameters without optional cid', () => {
      const validParams = {
        uri: 'at://did:plc:abc123/pub.chive.eprint.submission/abc123',
      };

      const result = validator.validateParams('pub.chive.eprint.getSubmission', validParams);
      expect(result.valid).toBe(true);
    });

    it('rejects getSubmission parameters without required uri', () => {
      const invalidParams = {
        cid: 'bafyreibwkjvc2wlkqn3v6jxlp2w3z4',
      };

      const result = validator.validateParams('pub.chive.eprint.getSubmission', invalidParams);
      expect(result.valid).toBe(false);
    });

    it('validates searchSubmissions query parameters', () => {
      const validParams = {
        q: 'clause-embedding predicates',
        author: 'did:plc:abc123',
        limit: 25,
      };

      const result = validator.validateParams('pub.chive.eprint.searchSubmissions', validParams);
      expect(result.valid).toBe(true);
    });

    it('accepts searchSubmissions parameters without q (browsing mode)', () => {
      // q is optional - when omitted, returns recent eprints (browsing mode)
      const browsingParams = {
        author: 'did:plc:abc123',
        limit: 25,
      };

      const result = validator.validateParams('pub.chive.eprint.searchSubmissions', browsingParams);
      expect(result.valid).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('provides error messages for validation failures', () => {
      const invalidData = {
        title: 'Test',
        // Missing all required fields
      };

      const result = validator.validateRecord('pub.chive.eprint.submission', invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toHaveProperty('field');
      expect(result.errors[0]).toHaveProperty('errors');
    });
  });
});
