/**
 * Unit tests for AT Protocol type validators.
 *
 * @remarks
 * Tests validate that type guard functions correctly accept valid inputs
 * and reject invalid inputs according to AT Protocol specifications.
 */

import { describe, expect, it } from 'vitest';

import {
  isBlobRef,
  isValidMimeType,
  toAtUri,
  toCID,
  toDID,
  toNSID,
} from '@/types/atproto-validators.js';

describe('toAtUri', () => {
  it('should validate correct AT URIs', () => {
    const validUris = [
      'at://did:plc:abc123/pub.chive.eprint.submission/xyz789',
      'at://did:web:example.com/app.bsky.feed.post/3k2akj',
      'at://did:plc:z72i7hdynmk6r22z27h6tvur/pub.chive.review.comment/comment123',
    ];

    validUris.forEach((uri) => {
      expect(toAtUri(uri)).toBe(uri);
    });
  });

  it('should reject invalid AT URIs', () => {
    const invalidUris = [
      'https://example.com',
      'at://not-a-did/collection/rkey',
      'at://did:plc:abc123/InvalidNSID/rkey',
      'at://did:plc:abc123/pub.chive.eprint.submission/',
      'at://did:plc:abc123/pub.chive.eprint.submission',
      '',
      'at://',
    ];

    invalidUris.forEach((uri) => {
      expect(toAtUri(uri)).toBeNull();
    });
  });
});

describe('toDID', () => {
  it('should validate correct DIDs', () => {
    const validDids = [
      'did:plc:z72i7hdynmk6r22z27h6tvur',
      'did:web:example.com',
      'did:web:alice.example.com',
      'did:key:abc123',
      'did:plc:abc-123_def.456',
    ];

    validDids.forEach((did) => {
      expect(toDID(did)).toBe(did);
    });
  });

  it('should reject invalid DIDs', () => {
    const invalidDids = [
      'not-a-did',
      'did:',
      'did:plc:',
      'did:PLC:abc123', // uppercase method
      'DID:plc:abc123', // uppercase prefix
      '',
      'did',
    ];

    invalidDids.forEach((did) => {
      expect(toDID(did)).toBeNull();
    });
  });
});

describe('toNSID', () => {
  it('should validate correct NSIDs', () => {
    const validNsids = [
      'pub.chive',
      'pub.chive.eprint.submission',
      'app.bsky.feed.post',
      'com.atproto.sync.subscribeRepos',
      'pub.chive.review.comment',
      'io.example.app.record',
    ];

    validNsids.forEach((nsid) => {
      expect(toNSID(nsid)).toBe(nsid);
    });
  });

  it('should reject invalid NSIDs', () => {
    const invalidNsids = [
      'InvalidNSID',
      'pub.Chive.eprint', // uppercase
      'pub',
      'pub.',
      '.pub.chive',
      'pub..chive',
      '',
      'pub.chive!invalid',
    ];

    invalidNsids.forEach((nsid) => {
      expect(toNSID(nsid)).toBeNull();
    });
  });
});

describe('toCID', () => {
  it('should validate correct CIDs', () => {
    const validCids = [
      'bafyreib2rxk3rybk3aobmv5dgudb4vls5sj3bkxfq7c42wgk6b6a7q',
      'bafkreiabcdefghijklmnopqrstuvwxyz123456789',
      'bafmzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
      'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG', // CIDv0
    ];

    validCids.forEach((cid) => {
      expect(toCID(cid)).toBe(cid);
    });
  });

  it('should reject invalid CIDs', () => {
    const invalidCids = [
      'not-a-cid',
      'bafy', // too short
      'invalid-cid',
      '',
      'bafyABC', // too short
      'xyz123abc', // wrong prefix
    ];

    invalidCids.forEach((cid) => {
      expect(toCID(cid)).toBeNull();
    });
  });
});

describe('isBlobRef', () => {
  it('should validate correct BlobRef objects', () => {
    const validBlobRefs = [
      {
        $type: 'blob' as const,
        ref: 'bafyreib2rxk3rybk3aobmv5dgudb4vls5sj3bkxfq7c42wgk6b6a7q',
        mimeType: 'application/pdf',
        size: 2048576,
      },
      {
        $type: 'blob' as const,
        ref: 'bafkreiabcdefghijklmnopqrstuvwxyz123456789',
        mimeType: 'image/png',
        size: 1024,
      },
    ];

    validBlobRefs.forEach((blobRef) => {
      expect(isBlobRef(blobRef)).toBe(true);
    });
  });

  it('should reject invalid BlobRef objects', () => {
    const invalidBlobRefs = [
      null,
      undefined,
      {},
      { $type: 'blob' }, // missing fields
      { $type: 'blob', ref: 'cid', mimeType: 'application/pdf' }, // missing size
      { $type: 'notblob', ref: 'cid', mimeType: 'application/pdf', size: 100 },
      { ref: 'cid', mimeType: 'application/pdf', size: 100 }, // missing $type
      'not an object',
      123,
    ];

    invalidBlobRefs.forEach((blobRef) => {
      expect(isBlobRef(blobRef)).toBe(false);
    });
  });
});

describe('isValidMimeType', () => {
  it('should validate correct MIME types', () => {
    const validMimeTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'text/plain',
      'application/json',
      'video/mp4',
      'text/plain; charset=utf-8',
      'application/vnd.ms-excel',
      'application/x-gzip',
    ];

    validMimeTypes.forEach((mimeType) => {
      expect(isValidMimeType(mimeType)).toBe(true);
    });
  });

  it('should reject invalid MIME types', () => {
    const invalidMimeTypes = [
      'invalid',
      'application/',
      '/subtype',
      'application',
      '',
      'application/pdf/extra',
      'APPLICATION/PDF', // should accept but testing case sensitivity
    ];

    invalidMimeTypes.forEach((mimeType) => {
      if (mimeType === 'APPLICATION/PDF') {
        // This should actually pass due to case-insensitive regex
        expect(isValidMimeType(mimeType)).toBe(true);
      } else {
        expect(isValidMimeType(mimeType)).toBe(false);
      }
    });
  });
});
