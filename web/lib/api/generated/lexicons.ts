// @ts-nocheck
/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  type LexiconDoc,
  Lexicons,
  ValidationError,
  type ValidationResult,
} from '@atproto/lexicon';
import { type $Typed, is$typed, maybe$typed } from './util.js';

export const schemaDict = {
  ComAtprotoRepoApplyWrites: {
    lexicon: 1,
    id: 'com.atproto.repo.applyWrites',
    defs: {
      main: {
        type: 'procedure',
        description:
          'Apply a batch transaction of repository creates, updates, and deletes. Requires auth, implemented by PDS.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['repo', 'writes'],
            properties: {
              repo: {
                type: 'string',
                format: 'at-identifier',
                description: 'The handle or DID of the repo (aka, current account).',
              },
              validate: {
                type: 'boolean',
                description:
                  "Can be set to 'false' to skip Lexicon schema validation of record data across all operations, 'true' to require it, or leave unset to validate only for known Lexicons.",
              },
              writes: {
                type: 'array',
                items: {
                  type: 'union',
                  refs: [
                    'lex:com.atproto.repo.applyWrites#create',
                    'lex:com.atproto.repo.applyWrites#update',
                    'lex:com.atproto.repo.applyWrites#delete',
                  ],
                  closed: true,
                },
              },
              swapCommit: {
                type: 'string',
                description:
                  'If provided, the entire operation will fail if the current repo commit CID does not match this value. Used to prevent conflicting repo mutations.',
                format: 'cid',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: [],
            properties: {
              commit: {
                type: 'ref',
                ref: 'lex:com.atproto.repo.defs#commitMeta',
              },
              results: {
                type: 'array',
                items: {
                  type: 'union',
                  refs: [
                    'lex:com.atproto.repo.applyWrites#createResult',
                    'lex:com.atproto.repo.applyWrites#updateResult',
                    'lex:com.atproto.repo.applyWrites#deleteResult',
                  ],
                  closed: true,
                },
              },
            },
          },
        },
        errors: [
          {
            name: 'InvalidSwap',
            description: "Indicates that the 'swapCommit' parameter did not match current commit.",
          },
        ],
      },
      create: {
        type: 'object',
        description: 'Operation which creates a new record.',
        required: ['collection', 'value'],
        properties: {
          collection: {
            type: 'string',
            format: 'nsid',
          },
          rkey: {
            type: 'string',
            maxLength: 512,
            format: 'record-key',
            description:
              'NOTE: maxLength is redundant with record-key format. Keeping it temporarily to ensure backwards compatibility.',
          },
          value: {
            type: 'unknown',
          },
        },
      },
      update: {
        type: 'object',
        description: 'Operation which updates an existing record.',
        required: ['collection', 'rkey', 'value'],
        properties: {
          collection: {
            type: 'string',
            format: 'nsid',
          },
          rkey: {
            type: 'string',
            format: 'record-key',
          },
          value: {
            type: 'unknown',
          },
        },
      },
      delete: {
        type: 'object',
        description: 'Operation which deletes an existing record.',
        required: ['collection', 'rkey'],
        properties: {
          collection: {
            type: 'string',
            format: 'nsid',
          },
          rkey: {
            type: 'string',
            format: 'record-key',
          },
        },
      },
      createResult: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
          validationStatus: {
            type: 'string',
            knownValues: ['valid', 'unknown'],
          },
        },
      },
      updateResult: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
          validationStatus: {
            type: 'string',
            knownValues: ['valid', 'unknown'],
          },
        },
      },
      deleteResult: {
        type: 'object',
        required: [],
        properties: {},
      },
    },
  },
  ComAtprotoRepoCreateRecord: {
    lexicon: 1,
    id: 'com.atproto.repo.createRecord',
    defs: {
      main: {
        type: 'procedure',
        description: 'Create a single new repository record. Requires auth, implemented by PDS.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['repo', 'collection', 'record'],
            properties: {
              repo: {
                type: 'string',
                format: 'at-identifier',
                description: 'The handle or DID of the repo (aka, current account).',
              },
              collection: {
                type: 'string',
                format: 'nsid',
                description: 'The NSID of the record collection.',
              },
              rkey: {
                type: 'string',
                format: 'record-key',
                description: 'The Record Key.',
                maxLength: 512,
              },
              validate: {
                type: 'boolean',
                description:
                  "Can be set to 'false' to skip Lexicon schema validation of record data, 'true' to require it, or leave unset to validate only for known Lexicons.",
              },
              record: {
                type: 'unknown',
                description: 'The record itself. Must contain a $type field.',
              },
              swapCommit: {
                type: 'string',
                format: 'cid',
                description: 'Compare and swap with the previous commit by CID.',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['uri', 'cid'],
            properties: {
              uri: {
                type: 'string',
                format: 'at-uri',
              },
              cid: {
                type: 'string',
                format: 'cid',
              },
              commit: {
                type: 'ref',
                ref: 'lex:com.atproto.repo.defs#commitMeta',
              },
              validationStatus: {
                type: 'string',
                knownValues: ['valid', 'unknown'],
              },
            },
          },
        },
        errors: [
          {
            name: 'InvalidSwap',
            description: "Indicates that 'swapCommit' didn't match current repo commit.",
          },
        ],
      },
    },
  },
  ComAtprotoRepoDefs: {
    lexicon: 1,
    id: 'com.atproto.repo.defs',
    defs: {
      commitMeta: {
        type: 'object',
        required: ['cid', 'rev'],
        properties: {
          cid: {
            type: 'string',
            format: 'cid',
          },
          rev: {
            type: 'string',
            format: 'tid',
          },
        },
      },
    },
  },
  ComAtprotoRepoDeleteRecord: {
    lexicon: 1,
    id: 'com.atproto.repo.deleteRecord',
    defs: {
      main: {
        type: 'procedure',
        description:
          "Delete a repository record, or ensure it doesn't exist. Requires auth, implemented by PDS.",
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['repo', 'collection', 'rkey'],
            properties: {
              repo: {
                type: 'string',
                format: 'at-identifier',
                description: 'The handle or DID of the repo (aka, current account).',
              },
              collection: {
                type: 'string',
                format: 'nsid',
                description: 'The NSID of the record collection.',
              },
              rkey: {
                type: 'string',
                format: 'record-key',
                description: 'The Record Key.',
              },
              swapRecord: {
                type: 'string',
                format: 'cid',
                description: 'Compare and swap with the previous record by CID.',
              },
              swapCommit: {
                type: 'string',
                format: 'cid',
                description: 'Compare and swap with the previous commit by CID.',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            properties: {
              commit: {
                type: 'ref',
                ref: 'lex:com.atproto.repo.defs#commitMeta',
              },
            },
          },
        },
        errors: [
          {
            name: 'InvalidSwap',
          },
        ],
      },
    },
  },
  ComAtprotoRepoDescribeRepo: {
    lexicon: 1,
    id: 'com.atproto.repo.describeRepo',
    defs: {
      main: {
        type: 'query',
        description:
          'Get information about an account and repository, including the list of collections. Does not require auth.',
        parameters: {
          type: 'params',
          required: ['repo'],
          properties: {
            repo: {
              type: 'string',
              format: 'at-identifier',
              description: 'The handle or DID of the repo.',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['handle', 'did', 'didDoc', 'collections', 'handleIsCorrect'],
            properties: {
              handle: {
                type: 'string',
                format: 'handle',
              },
              did: {
                type: 'string',
                format: 'did',
              },
              didDoc: {
                type: 'unknown',
                description: 'The complete DID document for this account.',
              },
              collections: {
                type: 'array',
                description:
                  'List of all the collections (NSIDs) for which this repo contains at least one record.',
                items: {
                  type: 'string',
                  format: 'nsid',
                },
              },
              handleIsCorrect: {
                type: 'boolean',
                description: 'Indicates if handle is currently valid (resolves bi-directionally)',
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoRepoGetRecord: {
    lexicon: 1,
    id: 'com.atproto.repo.getRecord',
    defs: {
      main: {
        type: 'query',
        description: 'Get a single record from a repository. Does not require auth.',
        parameters: {
          type: 'params',
          required: ['repo', 'collection', 'rkey'],
          properties: {
            repo: {
              type: 'string',
              format: 'at-identifier',
              description: 'The handle or DID of the repo.',
            },
            collection: {
              type: 'string',
              format: 'nsid',
              description: 'The NSID of the record collection.',
            },
            rkey: {
              type: 'string',
              description: 'The Record Key.',
              format: 'record-key',
            },
            cid: {
              type: 'string',
              format: 'cid',
              description:
                'The CID of the version of the record. If not specified, then return the most recent version.',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['uri', 'value'],
            properties: {
              uri: {
                type: 'string',
                format: 'at-uri',
              },
              cid: {
                type: 'string',
                format: 'cid',
              },
              value: {
                type: 'unknown',
              },
            },
          },
        },
        errors: [
          {
            name: 'RecordNotFound',
          },
        ],
      },
    },
  },
  ComAtprotoRepoImportRepo: {
    lexicon: 1,
    id: 'com.atproto.repo.importRepo',
    defs: {
      main: {
        type: 'procedure',
        description:
          'Import a repo in the form of a CAR file. Requires Content-Length HTTP header to be set.',
        input: {
          encoding: 'application/vnd.ipld.car',
        },
      },
    },
  },
  ComAtprotoRepoListMissingBlobs: {
    lexicon: 1,
    id: 'com.atproto.repo.listMissingBlobs',
    defs: {
      main: {
        type: 'query',
        description:
          'Returns a list of missing blobs for the requesting account. Intended to be used in the account migration flow.',
        parameters: {
          type: 'params',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 1000,
              default: 500,
            },
            cursor: {
              type: 'string',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['blobs'],
            properties: {
              cursor: {
                type: 'string',
              },
              blobs: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:com.atproto.repo.listMissingBlobs#recordBlob',
                },
              },
            },
          },
        },
      },
      recordBlob: {
        type: 'object',
        required: ['cid', 'recordUri'],
        properties: {
          cid: {
            type: 'string',
            format: 'cid',
          },
          recordUri: {
            type: 'string',
            format: 'at-uri',
          },
        },
      },
    },
  },
  ComAtprotoRepoListRecords: {
    lexicon: 1,
    id: 'com.atproto.repo.listRecords',
    defs: {
      main: {
        type: 'query',
        description:
          'List a range of records in a repository, matching a specific collection. Does not require auth.',
        parameters: {
          type: 'params',
          required: ['repo', 'collection'],
          properties: {
            repo: {
              type: 'string',
              format: 'at-identifier',
              description: 'The handle or DID of the repo.',
            },
            collection: {
              type: 'string',
              format: 'nsid',
              description: 'The NSID of the record type.',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'The number of records to return.',
            },
            cursor: {
              type: 'string',
            },
            reverse: {
              type: 'boolean',
              description: 'Flag to reverse the order of the returned records.',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['records'],
            properties: {
              cursor: {
                type: 'string',
              },
              records: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:com.atproto.repo.listRecords#record',
                },
              },
            },
          },
        },
      },
      record: {
        type: 'object',
        required: ['uri', 'cid', 'value'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
          value: {
            type: 'unknown',
          },
        },
      },
    },
  },
  ComAtprotoRepoPutRecord: {
    lexicon: 1,
    id: 'com.atproto.repo.putRecord',
    defs: {
      main: {
        type: 'procedure',
        description:
          'Write a repository record, creating or updating it as needed. Requires auth, implemented by PDS.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['repo', 'collection', 'rkey', 'record'],
            nullable: ['swapRecord'],
            properties: {
              repo: {
                type: 'string',
                format: 'at-identifier',
                description: 'The handle or DID of the repo (aka, current account).',
              },
              collection: {
                type: 'string',
                format: 'nsid',
                description: 'The NSID of the record collection.',
              },
              rkey: {
                type: 'string',
                format: 'record-key',
                description: 'The Record Key.',
                maxLength: 512,
              },
              validate: {
                type: 'boolean',
                description:
                  "Can be set to 'false' to skip Lexicon schema validation of record data, 'true' to require it, or leave unset to validate only for known Lexicons.",
              },
              record: {
                type: 'unknown',
                description: 'The record to write.',
              },
              swapRecord: {
                type: 'string',
                format: 'cid',
                description:
                  'Compare and swap with the previous record by CID. WARNING: nullable and optional field; may cause problems with golang implementation',
              },
              swapCommit: {
                type: 'string',
                format: 'cid',
                description: 'Compare and swap with the previous commit by CID.',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['uri', 'cid'],
            properties: {
              uri: {
                type: 'string',
                format: 'at-uri',
              },
              cid: {
                type: 'string',
                format: 'cid',
              },
              commit: {
                type: 'ref',
                ref: 'lex:com.atproto.repo.defs#commitMeta',
              },
              validationStatus: {
                type: 'string',
                knownValues: ['valid', 'unknown'],
              },
            },
          },
        },
        errors: [
          {
            name: 'InvalidSwap',
          },
        ],
      },
    },
  },
  ComAtprotoRepoStrongRef: {
    lexicon: 1,
    id: 'com.atproto.repo.strongRef',
    description: 'A URI with a content-hash fingerprint.',
    defs: {
      main: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
        },
      },
    },
  },
  ComAtprotoRepoUploadBlob: {
    lexicon: 1,
    id: 'com.atproto.repo.uploadBlob',
    defs: {
      main: {
        type: 'procedure',
        description:
          'Upload a new blob, to be referenced from a repository record. The blob will be deleted if it is not referenced within a time window (eg, minutes). Blob restrictions (mimetype, size, etc) are enforced when the reference is created. Requires auth, implemented by PDS.',
        input: {
          encoding: '*/*',
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['blob'],
            properties: {
              blob: {
                type: 'blob',
              },
            },
          },
        },
      },
    },
  },
  PubChiveActivityGetCorrelationMetrics: {
    lexicon: 1,
    id: 'pub.chive.activity.getCorrelationMetrics',
    defs: {
      main: {
        type: 'query',
        description:
          'Get activity correlation metrics showing confirmation rates, latencies, and error counts by category (admin only)',
        parameters: {
          type: 'params',
          properties: {},
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['metrics', 'pendingCount'],
            properties: {
              metrics: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.activity.getCorrelationMetrics#metricsEntry',
                },
              },
              pendingCount: {
                type: 'integer',
                description: 'Current count of pending activities',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'AuthorizationRequired',
          },
        ],
      },
      metricsEntry: {
        type: 'object',
        description: 'Correlation metrics for a time bucket and category',
        required: [
          'hour',
          'category',
          'total',
          'confirmed',
          'failed',
          'timeout',
          'pending',
          'confirmationRatePct',
        ],
        properties: {
          hour: {
            type: 'string',
            format: 'datetime',
            description: 'Hour bucket timestamp',
          },
          category: {
            type: 'string',
            knownValues: [
              'eprint_submit',
              'eprint_update',
              'eprint_delete',
              'review_create',
              'review_update',
              'review_delete',
              'endorsement_create',
              'endorsement_delete',
              'tag_create',
              'tag_delete',
              'profile_update',
              'proposal_create',
              'vote_create',
            ],
            description: 'Activity category',
          },
          total: {
            type: 'integer',
            description: 'Total activities in this bucket',
          },
          confirmed: {
            type: 'integer',
            description: 'Number of confirmed activities',
          },
          failed: {
            type: 'integer',
            description: 'Number of failed activities',
          },
          timeout: {
            type: 'integer',
            description: 'Number of timed out activities',
          },
          pending: {
            type: 'integer',
            description: 'Number of pending activities',
          },
          confirmationRatePct: {
            type: 'integer',
            description: 'Confirmation rate as percentage (0-100)',
          },
          avgLatencyMs: {
            type: 'integer',
            description: 'Average latency in milliseconds',
          },
          p95LatencyMs: {
            type: 'integer',
            description: '95th percentile latency in milliseconds',
          },
        },
      },
    },
  },
  PubChiveActivityGetFeed: {
    lexicon: 1,
    id: 'pub.chive.activity.getFeed',
    defs: {
      main: {
        type: 'query',
        description: "Get the authenticated user's activity feed with pagination",
        parameters: {
          type: 'params',
          properties: {
            category: {
              type: 'string',
              description: 'Filter by activity category',
              knownValues: [
                'eprint_submit',
                'eprint_update',
                'eprint_delete',
                'review_create',
                'review_update',
                'review_delete',
                'endorsement_create',
                'endorsement_delete',
                'tag_create',
                'tag_delete',
                'profile_update',
                'proposal_create',
                'vote_create',
              ],
            },
            status: {
              type: 'string',
              description: 'Filter by activity status',
              knownValues: ['pending', 'confirmed', 'failed', 'timeout'],
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Maximum number of results to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['activities', 'hasMore'],
            properties: {
              activities: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.activity.getFeed#activityView',
                },
              },
              cursor: {
                type: 'string',
                description: 'Pagination cursor for next page',
              },
              hasMore: {
                type: 'boolean',
                description: 'Whether more results are available',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
        ],
      },
      activityView: {
        type: 'object',
        description: 'View of an activity log entry',
        required: [
          'id',
          'actorDid',
          'collection',
          'rkey',
          'action',
          'category',
          'status',
          'initiatedAt',
        ],
        properties: {
          id: {
            type: 'string',
            description: 'Unique activity identifier (UUID)',
          },
          actorDid: {
            type: 'string',
            format: 'did',
            description: 'DID of user who initiated the action',
          },
          collection: {
            type: 'string',
            description: 'NSID of the record collection',
          },
          rkey: {
            type: 'string',
            description: 'Record key',
          },
          action: {
            type: 'string',
            knownValues: ['create', 'update', 'delete'],
            description: 'Action type',
          },
          category: {
            type: 'string',
            knownValues: [
              'eprint_submit',
              'eprint_update',
              'eprint_delete',
              'review_create',
              'review_update',
              'review_delete',
              'endorsement_create',
              'endorsement_delete',
              'tag_create',
              'tag_delete',
              'profile_update',
              'proposal_create',
              'vote_create',
            ],
            description: 'Semantic activity category',
          },
          status: {
            type: 'string',
            knownValues: ['pending', 'confirmed', 'failed', 'timeout'],
            description: 'Activity status',
          },
          initiatedAt: {
            type: 'string',
            format: 'datetime',
            description: 'When user initiated the action',
          },
          confirmedAt: {
            type: 'string',
            format: 'datetime',
            description: 'When firehose confirmed the action',
          },
          firehoseUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI from firehose confirmation',
          },
          firehoseCid: {
            type: 'string',
            description: 'CID from firehose confirmation',
          },
          targetUri: {
            type: 'string',
            format: 'at-uri',
            description: 'Target record URI',
          },
          targetTitle: {
            type: 'string',
            description: 'Target record title for display',
          },
          latencyMs: {
            type: 'integer',
            description: 'Latency from UI initiation to firehose confirmation (milliseconds)',
          },
          errorCode: {
            type: 'string',
            description: 'Error code if activity failed',
          },
          errorMessage: {
            type: 'string',
            description: 'Error message if activity failed',
          },
        },
      },
    },
  },
  PubChiveActivityLog: {
    lexicon: 1,
    id: 'pub.chive.activity.log',
    defs: {
      main: {
        type: 'procedure',
        description:
          "Log a user-initiated write action before performing PDS write. The activity is stored with status='pending' until the firehose event is received and correlated.",
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['collection', 'rkey', 'action', 'category'],
            properties: {
              collection: {
                type: 'string',
                description: 'NSID of the record collection',
              },
              rkey: {
                type: 'string',
                description: 'Record key (TID)',
              },
              action: {
                type: 'string',
                knownValues: ['create', 'update', 'delete'],
                description: 'Action type',
              },
              category: {
                type: 'string',
                knownValues: [
                  'eprint_submit',
                  'eprint_update',
                  'eprint_delete',
                  'review_create',
                  'review_update',
                  'review_delete',
                  'endorsement_create',
                  'endorsement_delete',
                  'tag_create',
                  'tag_delete',
                  'profile_update',
                  'proposal_create',
                  'vote_create',
                ],
                description: 'Semantic activity category',
              },
              targetUri: {
                type: 'string',
                format: 'at-uri',
                description: 'Target record URI (e.g., the eprint being reviewed)',
              },
              targetTitle: {
                type: 'string',
                maxLength: 500,
                description: 'Target record title for display',
              },
              traceId: {
                type: 'string',
                minLength: 32,
                maxLength: 32,
                description: 'OpenTelemetry trace ID',
              },
              spanId: {
                type: 'string',
                minLength: 16,
                maxLength: 16,
                description: 'OpenTelemetry span ID',
              },
              uiContext: {
                type: 'string',
                maxLength: 10000,
                description: 'UI context metadata as JSON string',
              },
              recordSnapshot: {
                type: 'string',
                maxLength: 50000,
                description: 'Snapshot of record data being written as JSON string',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['activityId'],
            properties: {
              activityId: {
                type: 'string',
                description: 'Created activity ID (UUID)',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'InvalidRequest',
          },
        ],
      },
    },
  },
  PubChiveActivityMarkFailed: {
    lexicon: 1,
    id: 'pub.chive.activity.markFailed',
    defs: {
      main: {
        type: 'procedure',
        description: 'Mark a pending activity as failed when PDS write fails',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['collection', 'rkey', 'errorCode', 'errorMessage'],
            properties: {
              collection: {
                type: 'string',
                description: 'NSID of the record collection',
              },
              rkey: {
                type: 'string',
                description: 'Record key (TID)',
              },
              errorCode: {
                type: 'string',
                maxLength: 50,
                description: 'Error code identifying the failure type',
              },
              errorMessage: {
                type: 'string',
                maxLength: 1000,
                description: 'Human-readable error message',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['success'],
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the activity was successfully marked as failed',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'NotFound',
          },
        ],
      },
    },
  },
  PubChiveActorAutocompleteAffiliation: {
    lexicon: 1,
    id: 'pub.chive.actor.autocompleteAffiliation',
    defs: {
      main: {
        type: 'query',
        description:
          'Autocomplete institutional affiliations using the Research Organization Registry (ROR) API',
        parameters: {
          type: 'params',
          required: ['query'],
          properties: {
            query: {
              type: 'string',
              minLength: 1,
              description: 'Search query for institution name',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 50,
              default: 8,
              description: 'Maximum number of suggestions to return',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['suggestions'],
            properties: {
              suggestions: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.actor.autocompleteAffiliation#affiliationSuggestion',
                },
              },
            },
          },
        },
        errors: [],
      },
      affiliationSuggestion: {
        type: 'object',
        description: 'An affiliation suggestion from the ROR database',
        required: ['rorId', 'name', 'country', 'types'],
        properties: {
          rorId: {
            type: 'string',
            description: 'ROR identifier URL (e.g., https://ror.org/02mhbdp94)',
          },
          name: {
            type: 'string',
            description: 'Display name of the institution',
          },
          country: {
            type: 'string',
            description: 'Country where the institution is located',
          },
          types: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Organization types (e.g., Education, Nonprofit)',
          },
          acronym: {
            type: 'string',
            description: 'Institution acronym if available',
          },
        },
      },
    },
  },
  PubChiveActorAutocompleteKeyword: {
    lexicon: 1,
    id: 'pub.chive.actor.autocompleteKeyword',
    defs: {
      main: {
        type: 'query',
        description:
          'Autocomplete research keywords using FAST subject headings and Wikidata entities',
        parameters: {
          type: 'params',
          required: ['query'],
          properties: {
            query: {
              type: 'string',
              minLength: 1,
              description: 'Search query for keyword',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 50,
              default: 8,
              description: 'Maximum number of suggestions to return',
            },
            sources: {
              type: 'array',
              items: {
                type: 'string',
                knownValues: ['fast', 'wikidata'],
              },
              description: 'Data sources to query (defaults to both)',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['suggestions'],
            properties: {
              suggestions: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.actor.autocompleteKeyword#keywordSuggestion',
                },
              },
            },
          },
        },
        errors: [],
      },
      keywordSuggestion: {
        type: 'object',
        description: 'A keyword suggestion from FAST or Wikidata',
        required: ['id', 'label', 'source'],
        properties: {
          id: {
            type: 'string',
            description: 'Identifier from the source system (FAST ID or Wikidata Q-number)',
          },
          label: {
            type: 'string',
            description: 'Display label for the keyword',
          },
          source: {
            type: 'string',
            knownValues: ['fast', 'wikidata', 'freetext'],
            description: 'Source of the keyword suggestion',
          },
          description: {
            type: 'string',
            description: 'Description of the keyword (Wikidata only)',
          },
          usageCount: {
            type: 'integer',
            description: 'Usage count from FAST database',
          },
        },
      },
    },
  },
  PubChiveActorAutocompleteOpenReview: {
    lexicon: 1,
    id: 'pub.chive.actor.autocompleteOpenReview',
    defs: {
      main: {
        type: 'query',
        description:
          'Autocomplete OpenReview profiles (proxied since OpenReview API does not support CORS)',
        parameters: {
          type: 'params',
          required: ['query'],
          properties: {
            query: {
              type: 'string',
              minLength: 1,
              description: 'Search query for researcher name',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 50,
              default: 10,
              description: 'Maximum number of suggestions to return',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['suggestions'],
            properties: {
              suggestions: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.actor.autocompleteOpenReview#openReviewSuggestion',
                },
              },
            },
          },
        },
        errors: [],
      },
      openReviewSuggestion: {
        type: 'object',
        description: 'An OpenReview profile suggestion',
        required: ['id', 'displayName'],
        properties: {
          id: {
            type: 'string',
            description: 'OpenReview profile ID (e.g., ~John_Smith1)',
          },
          displayName: {
            type: 'string',
            description: 'Full name of the researcher',
          },
          institution: {
            type: 'string',
            description: 'Current institution if available',
          },
        },
      },
    },
  },
  PubChiveActorAutocompleteOrcid: {
    lexicon: 1,
    id: 'pub.chive.actor.autocompleteOrcid',
    defs: {
      main: {
        type: 'query',
        description: 'Autocomplete ORCID profiles for author verification',
        parameters: {
          type: 'params',
          required: ['query'],
          properties: {
            query: {
              type: 'string',
              minLength: 1,
              description: 'Search query for researcher name or ORCID',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 50,
              default: 8,
              description: 'Maximum number of suggestions to return',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['suggestions'],
            properties: {
              suggestions: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.actor.autocompleteOrcid#orcidSuggestion',
                },
              },
            },
          },
        },
        errors: [],
      },
      orcidSuggestion: {
        type: 'object',
        description: 'An ORCID profile suggestion',
        required: ['orcid'],
        properties: {
          orcid: {
            type: 'string',
            description: 'ORCID identifier (e.g., 0000-0002-1825-0097)',
          },
          givenNames: {
            type: 'string',
            description: 'Given (first) names',
          },
          familyName: {
            type: 'string',
            description: 'Family (last) name',
          },
          affiliation: {
            type: 'string',
            description: 'Current institutional affiliation',
          },
        },
      },
    },
  },
  PubChiveActorDiscoverAuthorIds: {
    lexicon: 1,
    id: 'pub.chive.actor.discoverAuthorIds',
    defs: {
      main: {
        type: 'query',
        description:
          'Discover external author IDs (OpenAlex, Semantic Scholar, etc.) by searching for a name across academic databases',
        parameters: {
          type: 'params',
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              description: 'Author name to search for',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 20,
              default: 5,
              description: 'Maximum number of matches to return',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['searchedName', 'matches'],
            properties: {
              searchedName: {
                type: 'string',
                description: 'The name that was searched',
              },
              matches: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.actor.discoverAuthorIds#authorMatch',
                },
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
        ],
      },
      authorMatch: {
        type: 'object',
        description: 'A potential author match from academic databases',
        required: ['displayName', 'worksCount', 'citedByCount', 'ids'],
        properties: {
          displayName: {
            type: 'string',
            description: 'Display name from the database',
          },
          institution: {
            type: 'string',
            description: 'Current institutional affiliation',
          },
          worksCount: {
            type: 'integer',
            minimum: 0,
            description: 'Number of works attributed to this author',
          },
          citedByCount: {
            type: 'integer',
            minimum: 0,
            description: 'Total citation count',
          },
          ids: {
            type: 'ref',
            ref: 'lex:pub.chive.actor.discoverAuthorIds#externalIds',
          },
        },
      },
      externalIds: {
        type: 'object',
        description: 'External author identifiers from various databases',
        properties: {
          openalex: {
            type: 'string',
            description: 'OpenAlex author ID (e.g., A5023888391)',
          },
          semanticScholar: {
            type: 'string',
            description: 'Semantic Scholar author ID',
          },
          orcid: {
            type: 'string',
            description: 'ORCID identifier',
          },
          dblp: {
            type: 'string',
            description: 'DBLP author identifier',
          },
        },
      },
    },
  },
  PubChiveActorGetDiscoverySettings: {
    lexicon: 1,
    id: 'pub.chive.actor.getDiscoverySettings',
    defs: {
      main: {
        type: 'query',
        description: "Get the authenticated user's discovery settings from their PDS",
        parameters: {
          type: 'params',
          properties: {},
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: [
              'enablePersonalization',
              'enableForYouFeed',
              'forYouSignals',
              'relatedPapersSignals',
              'citationNetworkDisplay',
              'showRecommendationReasons',
            ],
            properties: {
              enablePersonalization: {
                type: 'boolean',
                description: 'Enable personalized recommendations based on profile',
              },
              enableForYouFeed: {
                type: 'boolean',
                description: 'Show the For You personalized feed',
              },
              forYouSignals: {
                type: 'ref',
                ref: 'lex:pub.chive.actor.getDiscoverySettings#forYouSignals',
                description: 'Signals to use for For You recommendations',
              },
              relatedPapersSignals: {
                type: 'ref',
                ref: 'lex:pub.chive.actor.getDiscoverySettings#relatedPapersSignals',
                description: 'Signals to use for related papers',
              },
              citationNetworkDisplay: {
                type: 'string',
                knownValues: ['hidden', 'preview', 'expanded'],
                description: 'How to display citation network',
              },
              showRecommendationReasons: {
                type: 'boolean',
                description: 'Show explanations for why papers are recommended',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'PDSNotFound',
          },
        ],
      },
      forYouSignals: {
        type: 'object',
        description: 'Configuration for For You feed signals',
        properties: {
          fields: {
            type: 'boolean',
            description: "Show papers from user's research fields",
          },
          citations: {
            type: 'boolean',
            description: "Show papers citing user's work",
          },
          collaborators: {
            type: 'boolean',
            description: 'Show papers from collaborators',
          },
          trending: {
            type: 'boolean',
            description: "Show trending papers in user's fields",
          },
        },
      },
      relatedPapersSignals: {
        type: 'object',
        description: 'Configuration for related papers panel signals',
        properties: {
          citations: {
            type: 'boolean',
            description: 'Show citation-based relationships',
          },
          topics: {
            type: 'boolean',
            description: 'Show topic/concept-based relationships',
          },
        },
      },
    },
  },
  PubChiveActorGetMyProfile: {
    lexicon: 1,
    id: 'pub.chive.actor.getMyProfile',
    defs: {
      main: {
        type: 'query',
        description: "Get the authenticated user's Chive profile from their PDS",
        parameters: {
          type: 'params',
          properties: {},
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            properties: {
              displayName: {
                type: 'string',
                description: 'Display name',
              },
              bio: {
                type: 'string',
                description: 'Biography text',
              },
              orcid: {
                type: 'string',
                description: 'ORCID identifier',
              },
              affiliations: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.actor.getMyProfile#affiliation',
                },
                description: 'Current institutional affiliations',
              },
              fields: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Research field identifiers',
              },
              nameVariants: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Alternative name forms for paper matching',
              },
              previousAffiliations: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.actor.getMyProfile#affiliation',
                },
                description: 'Past institutional affiliations',
              },
              researchKeywords: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.actor.getMyProfile#researchKeyword',
                },
                description: 'Research topics and keywords',
              },
              semanticScholarId: {
                type: 'string',
                description: 'Semantic Scholar author ID',
              },
              openAlexId: {
                type: 'string',
                description: 'OpenAlex author ID',
              },
              googleScholarId: {
                type: 'string',
                description: 'Google Scholar profile ID',
              },
              arxivAuthorId: {
                type: 'string',
                description: 'arXiv author identifier',
              },
              openReviewId: {
                type: 'string',
                description: 'OpenReview profile ID',
              },
              dblpId: {
                type: 'string',
                description: 'DBLP author identifier',
              },
              scopusAuthorId: {
                type: 'string',
                description: 'Scopus author ID',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'PDSNotFound',
          },
        ],
      },
      affiliation: {
        type: 'object',
        description: 'Institutional affiliation',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Organization name',
          },
          rorId: {
            type: 'string',
            description: 'ROR ID for the institution',
          },
        },
      },
      researchKeyword: {
        type: 'object',
        description: 'Research keyword with optional authority IDs',
        required: ['label'],
        properties: {
          label: {
            type: 'string',
            description: 'Keyword label',
          },
          fastId: {
            type: 'string',
            description: 'FAST subject heading ID',
          },
          wikidataId: {
            type: 'string',
            description: 'Wikidata entity ID',
          },
        },
      },
    },
  },
  PubChiveActorProfile: {
    lexicon: 1,
    id: 'pub.chive.actor.profile',
    defs: {
      affiliation: {
        type: 'object',
        description: 'Institutional affiliation referencing an institution node',
        required: ['name'],
        properties: {
          institutionUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of institution node (subkind=institution)',
          },
          name: {
            type: 'string',
            description: 'Organization name (display fallback if no institutionUri)',
            maxLength: 200,
          },
          rorId: {
            type: 'string',
            description: 'ROR ID (e.g., https://ror.org/02mhbdp94) for legacy/external data',
            maxLength: 50,
          },
        },
      },
      keyword: {
        type: 'object',
        description: 'Research keyword referencing a topic node',
        required: ['label'],
        properties: {
          topicUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of topic node (subkind=topic)',
          },
          label: {
            type: 'string',
            description: 'Keyword label (display fallback if no topicUri)',
            maxLength: 100,
          },
          fastId: {
            type: 'string',
            description: 'FAST subject heading ID for legacy/external data',
            maxLength: 20,
          },
          wikidataId: {
            type: 'string',
            description: 'Wikidata entity ID (e.g., Q12345) for legacy/external data',
            maxLength: 20,
          },
        },
      },
      main: {
        type: 'record',
        description: 'Chive-specific author profile',
        key: 'self',
        record: {
          type: 'object',
          properties: {
            displayName: {
              type: 'string',
              maxLength: 200,
            },
            bio: {
              type: 'string',
              maxLength: 2000,
            },
            avatar: {
              type: 'blob',
              accept: ['image/png', 'image/jpeg'],
              maxSize: 1048576,
            },
            orcid: {
              type: 'string',
              description: 'ORCID identifier',
              pattern: '^\\d{4}-\\d{4}-\\d{4}-\\d{3}[0-9X]$',
            },
            affiliations: {
              type: 'array',
              description: 'Current institutional affiliations with optional ROR IDs',
              items: {
                type: 'ref',
                ref: 'lex:pub.chive.actor.profile#affiliation',
              },
              maxLength: 10,
            },
            fieldUris: {
              type: 'array',
              description: 'AT-URIs of field nodes (subkind=field)',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              maxLength: 20,
            },
            nameVariants: {
              type: 'array',
              description:
                "Alternative name forms for paper matching (e.g., maiden name, transliterations, initials like 'J. Smith')",
              items: {
                type: 'string',
                maxLength: 200,
              },
              maxLength: 20,
            },
            previousAffiliations: {
              type: 'array',
              description: 'Past institutional affiliations that may appear on older papers',
              items: {
                type: 'ref',
                ref: 'lex:pub.chive.actor.profile#affiliation',
              },
              maxLength: 20,
            },
            researchKeywords: {
              type: 'array',
              description: 'Research topics and keywords with optional authority IDs',
              items: {
                type: 'ref',
                ref: 'lex:pub.chive.actor.profile#keyword',
              },
              maxLength: 50,
            },
            semanticScholarId: {
              type: 'string',
              description: 'Semantic Scholar author ID',
              maxLength: 50,
            },
            openAlexId: {
              type: 'string',
              description: 'OpenAlex author ID (e.g., A5023888391)',
              maxLength: 50,
            },
            googleScholarId: {
              type: 'string',
              description: 'Google Scholar profile ID',
              maxLength: 50,
            },
            arxivAuthorId: {
              type: 'string',
              description: 'arXiv author identifier',
              maxLength: 100,
            },
            openReviewId: {
              type: 'string',
              description: 'OpenReview profile ID',
              maxLength: 100,
            },
            dblpId: {
              type: 'string',
              description: 'DBLP author identifier (e.g., homepages/s/JohnSmith)',
              maxLength: 200,
            },
            scopusAuthorId: {
              type: 'string',
              description: 'Scopus author ID',
              maxLength: 50,
            },
          },
        },
      },
    },
  },
  PubChiveAlphaApply: {
    lexicon: 1,
    id: 'pub.chive.alpha.apply',
    defs: {
      main: {
        type: 'procedure',
        description: 'Submit an alpha tester application. Requires authentication.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['email', 'sector', 'careerStage', 'researchKeywords'],
            properties: {
              email: {
                type: 'string',
                description: 'Contact email for notifications',
              },
              sector: {
                type: 'string',
                knownValues: [
                  'academia',
                  'industry',
                  'government',
                  'nonprofit',
                  'healthcare',
                  'independent',
                  'other',
                ],
                description: 'Organization type',
              },
              sectorOther: {
                type: 'string',
                maxLength: 100,
                description: "Custom sector if 'other' selected",
              },
              careerStage: {
                type: 'string',
                knownValues: [
                  'undergraduate',
                  'graduate-masters',
                  'graduate-phd',
                  'postdoc',
                  'research-staff',
                  'junior-faculty',
                  'senior-faculty',
                  'research-admin',
                  'librarian',
                  'science-communicator',
                  'policy-professional',
                  'retired',
                  'other',
                ],
                description: 'Career stage/position',
              },
              careerStageOther: {
                type: 'string',
                maxLength: 100,
                description: "Custom career stage if 'other' selected",
              },
              affiliations: {
                type: 'array',
                maxLength: 10,
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.alpha.apply#affiliation',
                },
                description: 'Institutional affiliations (optional)',
              },
              researchKeywords: {
                type: 'array',
                maxLength: 10,
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.alpha.apply#researchKeyword',
                },
                description: 'Research keywords',
              },
              motivation: {
                type: 'string',
                maxLength: 1000,
                description: 'Optional motivation statement',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['applicationId', 'status', 'createdAt'],
            properties: {
              applicationId: {
                type: 'string',
                description: 'UUID of the created application',
              },
              status: {
                type: 'string',
                knownValues: ['none', 'pending', 'approved', 'rejected'],
                description: 'Application status',
              },
              createdAt: {
                type: 'string',
                format: 'datetime',
                description: 'Application creation timestamp',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'InvalidEmail',
          },
          {
            name: 'InvalidRequest',
          },
        ],
      },
      affiliation: {
        type: 'object',
        description: 'Institutional affiliation',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 200,
            description: 'Institution name',
          },
          rorId: {
            type: 'string',
            maxLength: 100,
            description: 'ROR ID',
          },
        },
      },
      researchKeyword: {
        type: 'object',
        description: 'Research keyword with optional authority identifiers',
        required: ['label'],
        properties: {
          label: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Keyword label',
          },
          fastId: {
            type: 'string',
            maxLength: 20,
            description: 'FAST authority ID',
          },
          wikidataId: {
            type: 'string',
            maxLength: 20,
            description: 'Wikidata ID',
          },
        },
      },
    },
  },
  PubChiveAlphaCheckStatus: {
    lexicon: 1,
    id: 'pub.chive.alpha.checkStatus',
    defs: {
      main: {
        type: 'query',
        description:
          "Check the authenticated user's alpha tester application status. Requires authentication.",
        parameters: {
          type: 'params',
          properties: {},
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['status'],
            properties: {
              status: {
                type: 'string',
                knownValues: ['none', 'pending', 'approved', 'rejected'],
                description: 'Application status',
              },
              appliedAt: {
                type: 'string',
                format: 'datetime',
                description: 'Application submission timestamp',
              },
              reviewedAt: {
                type: 'string',
                format: 'datetime',
                description: 'Application review timestamp',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
        ],
      },
    },
  },
  PubChiveAuthorGetProfile: {
    lexicon: 1,
    id: 'pub.chive.author.getProfile',
    defs: {
      main: {
        type: 'query',
        description: 'Get author profile and metrics by DID',
        parameters: {
          type: 'params',
          required: ['did'],
          properties: {
            did: {
              type: 'string',
              format: 'did',
              description: 'Author DID',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['profile', 'metrics'],
            properties: {
              profile: {
                type: 'ref',
                ref: 'lex:pub.chive.author.getProfile#authorProfile',
              },
              metrics: {
                type: 'ref',
                ref: 'lex:pub.chive.author.getProfile#authorMetrics',
              },
            },
          },
        },
        errors: [
          {
            name: 'NotFound',
          },
        ],
      },
      authorProfile: {
        type: 'object',
        required: ['did'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
          },
          avatar: {
            type: 'string',
            format: 'uri',
          },
          bio: {
            type: 'string',
          },
          affiliation: {
            type: 'string',
          },
          affiliations: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.author.getProfile#affiliation',
            },
          },
          orcid: {
            type: 'string',
          },
          website: {
            type: 'string',
            format: 'uri',
          },
          pdsEndpoint: {
            type: 'string',
          },
          fields: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          nameVariants: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          previousAffiliations: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.author.getProfile#affiliation',
            },
          },
          researchKeywords: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.author.getProfile#researchKeyword',
            },
          },
          semanticScholarId: {
            type: 'string',
          },
          openAlexId: {
            type: 'string',
          },
          googleScholarId: {
            type: 'string',
          },
          arxivAuthorId: {
            type: 'string',
          },
          openReviewId: {
            type: 'string',
          },
          dblpId: {
            type: 'string',
          },
          scopusAuthorId: {
            type: 'string',
          },
        },
      },
      affiliation: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
          },
          rorId: {
            type: 'string',
          },
        },
      },
      researchKeyword: {
        type: 'object',
        required: ['label'],
        properties: {
          label: {
            type: 'string',
          },
          fastId: {
            type: 'string',
          },
          wikidataId: {
            type: 'string',
          },
        },
      },
      authorMetrics: {
        type: 'object',
        required: ['totalEprints', 'totalViews', 'totalDownloads', 'totalEndorsements'],
        properties: {
          totalEprints: {
            type: 'integer',
          },
          totalViews: {
            type: 'integer',
          },
          totalDownloads: {
            type: 'integer',
          },
          totalEndorsements: {
            type: 'integer',
          },
        },
      },
    },
  },
  PubChiveAuthorSearchAuthors: {
    lexicon: 1,
    id: 'pub.chive.author.searchAuthors',
    defs: {
      main: {
        type: 'query',
        description: 'Search for authors by name or other criteria',
        parameters: {
          type: 'params',
          required: ['q'],
          properties: {
            q: {
              type: 'string',
              minLength: 1,
              description: 'Search query',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 25,
              description: 'Maximum results to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['authors'],
            properties: {
              authors: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.author.searchAuthors#authorSearchResult',
                },
              },
              cursor: {
                type: 'string',
                description: 'Cursor for next page',
              },
            },
          },
        },
      },
      authorSearchResult: {
        type: 'object',
        required: ['did'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
          },
          avatar: {
            type: 'string',
            format: 'uri',
          },
          affiliation: {
            type: 'string',
          },
          eprintCount: {
            type: 'integer',
          },
        },
      },
    },
  },
  PubChiveBacklinkCreate: {
    lexicon: 1,
    id: 'pub.chive.backlink.create',
    defs: {
      main: {
        type: 'procedure',
        description: 'Create a backlink record. Internal/plugin use only. Requires authentication.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['sourceUri', 'sourceType', 'targetUri'],
            properties: {
              sourceUri: {
                type: 'string',
                format: 'at-uri',
                description: 'AT-URI of the source record',
              },
              sourceType: {
                type: 'string',
                knownValues: [
                  'semble.collection',
                  'leaflet.list',
                  'whitewind.blog',
                  'bluesky.post',
                  'bluesky.embed',
                  'other',
                ],
                description: 'Type of the source record',
              },
              targetUri: {
                type: 'string',
                format: 'at-uri',
                description: 'AT-URI of the target eprint',
              },
              context: {
                type: 'string',
                maxLength: 500,
                description: 'Optional context about the backlink',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:pub.chive.backlink.create#backlink',
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'InvalidRequest',
          },
        ],
      },
      backlink: {
        type: 'object',
        description: 'Backlink record',
        required: ['id', 'sourceUri', 'sourceType', 'targetUri', 'indexedAt', 'deleted'],
        properties: {
          id: {
            type: 'integer',
            description: 'Backlink ID',
          },
          sourceUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the source record',
          },
          sourceType: {
            type: 'string',
            knownValues: [
              'semble.collection',
              'leaflet.list',
              'whitewind.blog',
              'bluesky.post',
              'bluesky.embed',
              'other',
            ],
            description: 'Type of the source record',
          },
          targetUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the target eprint',
          },
          context: {
            type: 'string',
            maxLength: 500,
            description: 'Optional context about the backlink',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
            description: 'Timestamp when the backlink was indexed',
          },
          deleted: {
            type: 'boolean',
            description: 'Whether the backlink has been deleted',
          },
        },
      },
    },
  },
  PubChiveBacklinkDelete: {
    lexicon: 1,
    id: 'pub.chive.backlink.delete',
    defs: {
      main: {
        type: 'procedure',
        description:
          'Delete (mark as deleted) a backlink record. Internal/plugin use only. Requires authentication.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['sourceUri'],
            properties: {
              sourceUri: {
                type: 'string',
                format: 'at-uri',
                description: 'AT-URI of the source record to delete',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['success'],
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the deletion was successful',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'NotFound',
          },
        ],
      },
    },
  },
  PubChiveBacklinkGetCounts: {
    lexicon: 1,
    id: 'pub.chive.backlink.getCounts',
    defs: {
      main: {
        type: 'query',
        description: 'Get aggregated backlink counts for an eprint',
        parameters: {
          type: 'params',
          required: ['targetUri'],
          properties: {
            targetUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of the target eprint',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: [
              'sembleCollections',
              'leafletLists',
              'whitewindBlogs',
              'blueskyPosts',
              'blueskyEmbeds',
              'other',
              'total',
            ],
            properties: {
              sembleCollections: {
                type: 'integer',
                description: 'Count of Semble collection backlinks',
              },
              leafletLists: {
                type: 'integer',
                description: 'Count of Leaflet list backlinks',
              },
              whitewindBlogs: {
                type: 'integer',
                description: 'Count of Whitewind blog backlinks',
              },
              blueskyPosts: {
                type: 'integer',
                description: 'Count of Bluesky post backlinks',
              },
              blueskyEmbeds: {
                type: 'integer',
                description: 'Count of Bluesky embed backlinks',
              },
              other: {
                type: 'integer',
                description: 'Count of other backlinks',
              },
              total: {
                type: 'integer',
                description: 'Total count of all backlinks',
              },
            },
          },
        },
        errors: [
          {
            name: 'NotFound',
          },
        ],
      },
    },
  },
  PubChiveBacklinkList: {
    lexicon: 1,
    id: 'pub.chive.backlink.list',
    defs: {
      main: {
        type: 'query',
        description:
          'List backlinks to an eprint from ATProto ecosystem sources including Semble collections, Leaflet lists, Whitewind blogs, and Bluesky shares',
        parameters: {
          type: 'params',
          required: ['targetUri'],
          properties: {
            targetUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of the target eprint',
            },
            sourceType: {
              type: 'string',
              knownValues: [
                'semble.collection',
                'leaflet.list',
                'whitewind.blog',
                'bluesky.post',
                'bluesky.embed',
                'other',
              ],
              description: 'Filter by source type',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Maximum number of backlinks to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['backlinks', 'hasMore'],
            properties: {
              backlinks: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.backlink.list#backlink',
                },
                description: 'List of backlinks',
              },
              cursor: {
                type: 'string',
                description: 'Pagination cursor for next page',
              },
              hasMore: {
                type: 'boolean',
                description: 'Whether more results are available',
              },
            },
          },
        },
        errors: [
          {
            name: 'NotFound',
          },
        ],
      },
      backlink: {
        type: 'object',
        description: 'Backlink record',
        required: ['id', 'sourceUri', 'sourceType', 'targetUri', 'indexedAt', 'deleted'],
        properties: {
          id: {
            type: 'integer',
            description: 'Backlink ID',
          },
          sourceUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the source record',
          },
          sourceType: {
            type: 'string',
            knownValues: [
              'semble.collection',
              'leaflet.list',
              'whitewind.blog',
              'bluesky.post',
              'bluesky.embed',
              'other',
            ],
            description: 'Type of the source record',
          },
          targetUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the target eprint',
          },
          context: {
            type: 'string',
            maxLength: 500,
            description: 'Optional context about the backlink',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
            description: 'Timestamp when the backlink was indexed',
          },
          deleted: {
            type: 'boolean',
            description: 'Whether the backlink has been deleted',
          },
        },
      },
    },
  },
  PubChiveClaimingApproveClaim: {
    lexicon: 1,
    id: 'pub.chive.claiming.approveClaim',
    defs: {
      main: {
        type: 'procedure',
        description: 'Approve a pending claim request. Admin only.',
        parameters: {
          type: 'params',
          required: ['claimId'],
          properties: {
            claimId: {
              type: 'integer',
              minimum: 1,
              description: 'ID of the claim request to approve',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['success'],
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the approval was successful',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
            description: 'Authentication is required to approve claims',
          },
          {
            name: 'Forbidden',
            description: 'Only administrators can approve claims',
          },
          {
            name: 'ClaimNotFound',
            description: 'The specified claim does not exist',
          },
        ],
      },
    },
  },
  PubChiveClaimingApproveCoauthor: {
    lexicon: 1,
    id: 'pub.chive.claiming.approveCoauthor',
    defs: {
      main: {
        type: 'procedure',
        description: 'Approve a pending co-author request. Only the eprint owner can approve.',
        parameters: {
          type: 'params',
          required: ['requestId'],
          properties: {
            requestId: {
              type: 'integer',
              minimum: 1,
              description: 'ID of the co-author request to approve',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['success'],
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the approval was successful',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
            description: 'Authentication is required to approve co-author requests',
          },
          {
            name: 'Forbidden',
            description: 'Only the eprint owner can approve co-author requests',
          },
          {
            name: 'RequestNotFound',
            description: 'The specified co-author request does not exist',
          },
        ],
      },
    },
  },
  PubChiveClaimingAutocomplete: {
    lexicon: 1,
    id: 'pub.chive.claiming.autocomplete',
    defs: {
      main: {
        type: 'query',
        description:
          'Provides fast autocomplete suggestions for claiming search. Optimized for low latency with short timeouts.',
        parameters: {
          type: 'params',
          required: ['query'],
          properties: {
            query: {
              type: 'string',
              minLength: 2,
              description: 'Search query prefix',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 10,
              default: 8,
              description: 'Maximum number of suggestions to return',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['suggestions'],
            properties: {
              suggestions: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.claiming.autocomplete#suggestion',
                },
                description: 'List of autocomplete suggestions',
              },
            },
          },
        },
        errors: [],
      },
      suggestion: {
        type: 'object',
        description: 'An autocomplete suggestion for a claimable eprint',
        required: ['title', 'authors', 'source', 'externalId'],
        properties: {
          title: {
            type: 'string',
            description: 'Eprint title',
          },
          authors: {
            type: 'string',
            description: "First 2 authors joined (e.g., 'Author1, Author2 et al.')",
          },
          source: {
            type: 'string',
            description: 'External source identifier (e.g., arxiv, biorxiv)',
          },
          externalId: {
            type: 'string',
            description: 'Source-specific identifier',
          },
          highlightedTitle: {
            type: 'string',
            description: 'Title with query portion highlighted using markdown bold',
          },
          fieldMatchScore: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description: 'User field relevance score (0-100), present if authenticated',
          },
        },
      },
    },
  },
  PubChiveClaimingCompleteClaim: {
    lexicon: 1,
    id: 'pub.chive.claiming.completeClaim',
    defs: {
      main: {
        type: 'procedure',
        description:
          'Complete a claim after the user creates their canonical record in their PDS. Requires authentication and claimant ownership.',
        parameters: {
          type: 'params',
          required: ['claimId', 'canonicalUri'],
          properties: {
            claimId: {
              type: 'integer',
              minimum: 1,
              description: 'ID of the claim request to complete',
            },
            canonicalUri: {
              type: 'string',
              format: 'at-uri',
              description: "AT-URI of the canonical record created in user's PDS",
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['success'],
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the claim was successfully completed',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
            description: 'Authentication is required to complete claims',
          },
          {
            name: 'ClaimNotFound',
            description: 'The specified claim does not exist',
          },
          {
            name: 'Unauthorized',
            description: 'Only the claimant can complete their own claim',
          },
        ],
      },
    },
  },
  PubChiveClaimingFetchExternalPdf: {
    lexicon: 1,
    id: 'pub.chive.claiming.fetchExternalPdf',
    defs: {
      main: {
        type: 'query',
        description:
          'Fetch external PDF through proxy to avoid CORS issues. Returns PDF binary data. Only allows fetching from trusted academic sources.',
        parameters: {
          type: 'params',
          required: ['source', 'externalId'],
          properties: {
            source: {
              type: 'string',
              description: 'External source identifier (e.g., arxiv, biorxiv, medrxiv)',
            },
            externalId: {
              type: 'string',
              description: 'Source-specific identifier for the eprint',
            },
          },
        },
        output: {
          encoding: 'application/pdf',
          description: 'PDF binary data with Content-Disposition header for download',
        },
        errors: [
          {
            name: 'AuthenticationRequired',
            description: 'Authentication is required to fetch PDFs',
          },
          {
            name: 'InvalidParameters',
            description: 'Missing source or externalId parameter',
          },
          {
            name: 'EprintNotFound',
            description: 'The specified eprint does not exist in the external source',
          },
          {
            name: 'PdfNotAvailable',
            description: 'No PDF is available for this eprint',
          },
          {
            name: 'DomainNotAllowed',
            description: 'PDF URL is not from an allowed academic domain',
          },
          {
            name: 'FetchFailed',
            description: 'Failed to fetch PDF from external source',
          },
        ],
      },
    },
  },
  PubChiveClaimingFindClaimable: {
    lexicon: 1,
    id: 'pub.chive.claiming.findClaimable',
    defs: {
      main: {
        type: 'query',
        description:
          "Find claimable eprints matching the user's identity or search criteria. Requires authentication.",
        parameters: {
          type: 'params',
          properties: {
            q: {
              type: 'string',
              description: 'Search query (title, author name, DOI)',
            },
            source: {
              type: 'string',
              knownValues: [
                'arxiv',
                'biorxiv',
                'medrxiv',
                'osf',
                'lingbuzz',
                'zenodo',
                'ssrn',
                'philpapers',
              ],
              description: 'Filter by external source',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Maximum number of results to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor for next page',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['eprints', 'hasMore'],
            properties: {
              eprints: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.claiming.findClaimable#claimableEprint',
                },
                description: 'List of claimable eprints',
              },
              cursor: {
                type: 'string',
                description: 'Cursor for next page of results',
              },
              hasMore: {
                type: 'boolean',
                description: 'Whether more results are available',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
            description: 'Authentication is required to find claimable eprints',
          },
        ],
      },
      claimableEprint: {
        type: 'object',
        description: 'An eprint that can be claimed by the user',
        required: ['id', 'source', 'externalId', 'url', 'title', 'authors'],
        properties: {
          id: {
            type: 'integer',
            description: 'Internal import ID',
          },
          source: {
            type: 'string',
            description: 'External source identifier',
          },
          externalId: {
            type: 'string',
            description: 'Source-specific identifier',
          },
          url: {
            type: 'string',
            format: 'uri',
            description: 'URL to the eprint on the external source',
          },
          title: {
            type: 'string',
            description: 'Eprint title',
          },
          authors: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.claiming.findClaimable#eprintAuthor',
            },
            description: 'List of authors',
          },
          publicationDate: {
            type: 'string',
            format: 'datetime',
            description: 'Publication or submission date',
          },
          doi: {
            type: 'string',
            description: 'DOI if assigned',
          },
        },
      },
      eprintAuthor: {
        type: 'object',
        description: 'Author information from external source',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Author display name',
          },
          orcid: {
            type: 'string',
            description: 'ORCID identifier if available',
          },
          affiliation: {
            type: 'string',
            description: 'Institutional affiliation if available',
          },
        },
      },
    },
  },
  PubChiveClaimingGetClaim: {
    lexicon: 1,
    id: 'pub.chive.claiming.getClaim',
    defs: {
      main: {
        type: 'query',
        description:
          'Get a claim request by ID. Users can only view their own claims unless they are admins.',
        parameters: {
          type: 'params',
          required: ['claimId'],
          properties: {
            claimId: {
              type: 'integer',
              minimum: 1,
              description: 'ID of the claim request',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            properties: {
              claim: {
                type: 'ref',
                ref: 'lex:pub.chive.claiming.getClaim#claimRequest',
                description: 'The claim request, or null if not found or not authorized',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
            description: 'Authentication is required to get claims',
          },
        ],
      },
      claimRequest: {
        type: 'object',
        description: 'A claim request for an imported eprint',
        required: ['id', 'importId', 'claimantDid', 'status', 'createdAt'],
        properties: {
          id: {
            type: 'integer',
            description: 'Unique claim request ID',
          },
          importId: {
            type: 'integer',
            description: 'ID of the imported eprint being claimed',
          },
          claimantDid: {
            type: 'string',
            format: 'did',
            description: 'DID of the user making the claim',
          },
          status: {
            type: 'string',
            knownValues: ['pending', 'approved', 'rejected', 'expired'],
            description: 'Current status of the claim',
          },
          canonicalUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the canonical record once created',
          },
          rejectionReason: {
            type: 'string',
            description: 'Reason for rejection if rejected',
          },
          reviewedBy: {
            type: 'string',
            format: 'did',
            description: 'DID of the admin who reviewed the claim',
          },
          reviewedAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the claim was reviewed',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the claim was created',
          },
          expiresAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the claim expires if not completed',
          },
        },
      },
    },
  },
  PubChiveClaimingGetCoauthorRequests: {
    lexicon: 1,
    id: 'pub.chive.claiming.getCoauthorRequests',
    defs: {
      main: {
        type: 'query',
        description:
          "Get pending co-author requests for the authenticated user's eprints. Returns requests where the user is the eprint owner.",
        parameters: {
          type: 'params',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Maximum number of results to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor for next page',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['requests'],
            properties: {
              requests: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.claiming.getCoauthorRequests#coauthorRequest',
                },
                description: 'List of co-author requests',
              },
              cursor: {
                type: 'string',
                description: 'Cursor for next page of results',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
            description: 'Authentication is required to get co-author requests',
          },
        ],
      },
      coauthorRequest: {
        type: 'object',
        description: 'A co-author claim request',
        required: [
          'id',
          'eprintUri',
          'eprintOwnerDid',
          'claimantDid',
          'claimantName',
          'authorIndex',
          'authorName',
          'status',
          'createdAt',
        ],
        properties: {
          id: {
            type: 'integer',
            description: 'Unique request ID',
          },
          eprintUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the eprint record',
          },
          eprintOwnerDid: {
            type: 'string',
            format: 'did',
            description: 'DID of the eprint owner (PDS owner)',
          },
          claimantDid: {
            type: 'string',
            format: 'did',
            description: 'DID of the user requesting co-authorship',
          },
          claimantName: {
            type: 'string',
            description: 'Display name of the claimant at time of request',
          },
          authorIndex: {
            type: 'integer',
            minimum: 0,
            description: 'Index of the author entry being claimed (0-based)',
          },
          authorName: {
            type: 'string',
            description: 'Name of the author entry being claimed',
          },
          status: {
            type: 'string',
            knownValues: ['pending', 'approved', 'rejected'],
            description: 'Current status of the request',
          },
          message: {
            type: 'string',
            maxLength: 1000,
            description: 'Optional message from the claimant',
          },
          rejectionReason: {
            type: 'string',
            maxLength: 500,
            description: 'Reason for rejection if rejected',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the request was created',
          },
          reviewedAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the request was reviewed',
          },
        },
      },
    },
  },
  PubChiveClaimingGetMyCoauthorRequests: {
    lexicon: 1,
    id: 'pub.chive.claiming.getMyCoauthorRequests',
    defs: {
      main: {
        type: 'query',
        description:
          'Get co-author requests made by the authenticated user. Returns requests where the user is the claimant.',
        parameters: {
          type: 'params',
          properties: {
            status: {
              type: 'string',
              knownValues: ['pending', 'approved', 'rejected'],
              description: 'Filter by request status',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Maximum number of results to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor for next page',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['requests'],
            properties: {
              requests: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.claiming.getMyCoauthorRequests#coauthorRequest',
                },
                description: 'List of co-author requests made by the user',
              },
              cursor: {
                type: 'string',
                description: 'Cursor for next page of results',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
            description: 'Authentication is required to get your co-author requests',
          },
        ],
      },
      coauthorRequest: {
        type: 'object',
        description: 'A co-author claim request',
        required: [
          'id',
          'eprintUri',
          'eprintOwnerDid',
          'claimantDid',
          'claimantName',
          'authorIndex',
          'authorName',
          'status',
          'createdAt',
        ],
        properties: {
          id: {
            type: 'integer',
            description: 'Unique request ID',
          },
          eprintUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the eprint record',
          },
          eprintOwnerDid: {
            type: 'string',
            format: 'did',
            description: 'DID of the eprint owner (PDS owner)',
          },
          claimantDid: {
            type: 'string',
            format: 'did',
            description: 'DID of the user requesting co-authorship',
          },
          claimantName: {
            type: 'string',
            description: 'Display name of the claimant at time of request',
          },
          authorIndex: {
            type: 'integer',
            minimum: 0,
            description: 'Index of the author entry being claimed (0-based)',
          },
          authorName: {
            type: 'string',
            description: 'Name of the author entry being claimed',
          },
          status: {
            type: 'string',
            knownValues: ['pending', 'approved', 'rejected'],
            description: 'Current status of the request',
          },
          message: {
            type: 'string',
            maxLength: 1000,
            description: 'Optional message from the claimant',
          },
          rejectionReason: {
            type: 'string',
            maxLength: 500,
            description: 'Reason for rejection if rejected',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the request was created',
          },
          reviewedAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the request was reviewed',
          },
        },
      },
    },
  },
  PubChiveClaimingGetPendingClaims: {
    lexicon: 1,
    id: 'pub.chive.claiming.getPendingClaims',
    defs: {
      main: {
        type: 'query',
        description: 'Get pending claims for admin review. Admin only.',
        parameters: {
          type: 'params',
          properties: {
            minScore: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              description: 'Minimum match score filter (0-100)',
            },
            maxScore: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              description: 'Maximum match score filter (0-100)',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Maximum number of claims to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['claims', 'hasMore'],
            properties: {
              claims: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.claiming.getPendingClaims#claimRequest',
                },
              },
              cursor: {
                type: 'string',
                description: 'Pagination cursor for next page',
              },
              hasMore: {
                type: 'boolean',
                description: 'Whether more results are available',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'Forbidden',
          },
        ],
      },
      claimRequest: {
        type: 'object',
        required: ['id', 'importId', 'claimantDid', 'status', 'createdAt'],
        properties: {
          id: {
            type: 'integer',
            description: 'Claim request ID',
          },
          importId: {
            type: 'integer',
            description: 'ID of the imported eprint',
          },
          claimantDid: {
            type: 'string',
            format: 'did',
            description: 'DID of the claimant',
          },
          status: {
            type: 'string',
            knownValues: ['pending', 'approved', 'rejected', 'expired'],
            description: 'Claim status',
          },
          canonicalUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the canonical record in user PDS',
          },
          rejectionReason: {
            type: 'string',
            description: 'Reason for rejection if rejected',
          },
          reviewedBy: {
            type: 'string',
            format: 'did',
            description: 'DID of the admin who reviewed',
          },
          reviewedAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the claim was reviewed',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the claim was created',
          },
          expiresAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the claim expires',
          },
        },
      },
    },
  },
  PubChiveClaimingGetSubmissionData: {
    lexicon: 1,
    id: 'pub.chive.claiming.getSubmissionData',
    defs: {
      main: {
        type: 'query',
        description: 'Get prefilled form data for claiming a paper from an external source',
        parameters: {
          type: 'params',
          required: ['source', 'externalId'],
          properties: {
            source: {
              type: 'string',
              minLength: 2,
              maxLength: 50,
              description: 'External source (e.g., arxiv, semanticscholar)',
            },
            externalId: {
              type: 'string',
              description: 'Source-specific identifier',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: [
              'title',
              'abstract',
              'authors',
              'keywords',
              'source',
              'externalId',
              'externalUrl',
            ],
            properties: {
              title: {
                type: 'string',
                description: 'Prefilled title',
              },
              abstract: {
                type: 'string',
                description: 'Prefilled abstract',
              },
              authors: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.claiming.getSubmissionData#submissionAuthor',
                },
                description: 'Prefilled authors',
              },
              keywords: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Prefilled keywords/categories',
              },
              doi: {
                type: 'string',
                description: 'DOI if available',
              },
              pdfUrl: {
                type: 'string',
                format: 'uri',
                description: 'PDF URL if available',
              },
              source: {
                type: 'string',
                description: 'Source system',
              },
              externalId: {
                type: 'string',
                description: 'Source-specific external ID',
              },
              externalUrl: {
                type: 'string',
                format: 'uri',
                description: 'External URL to the paper',
              },
              publicationDate: {
                type: 'string',
                format: 'datetime',
                description: 'Publication date',
              },
              externalIds: {
                type: 'ref',
                ref: 'lex:pub.chive.claiming.getSubmissionData#externalIds',
              },
              existingChivePaper: {
                type: 'ref',
                ref: 'lex:pub.chive.claiming.getSubmissionData#existingChivePaper',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'NotFound',
          },
        ],
      },
      submissionAuthor: {
        type: 'object',
        required: ['order', 'name'],
        properties: {
          order: {
            type: 'integer',
            minimum: 1,
            description: 'Author order (1-indexed)',
          },
          name: {
            type: 'string',
            description: 'Author name',
          },
          orcid: {
            type: 'string',
            description: 'ORCID identifier',
          },
          email: {
            type: 'string',
            description: 'Email address',
          },
          affiliation: {
            type: 'string',
            description: 'Institution affiliation',
          },
        },
      },
      externalIds: {
        type: 'object',
        properties: {
          arxivId: {
            type: 'string',
            description: 'arXiv identifier',
          },
          doi: {
            type: 'string',
            description: 'DOI',
          },
        },
      },
      existingChivePaper: {
        type: 'object',
        required: ['uri', 'title', 'authors', 'createdAt'],
        description: 'Existing Chive paper if this is a duplicate',
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the existing paper',
          },
          title: {
            type: 'string',
            description: 'Paper title',
          },
          authors: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.claiming.getSubmissionData#existingAuthor',
            },
            description: 'Author list',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the paper was indexed',
          },
        },
      },
      existingAuthor: {
        type: 'object',
        required: ['name'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
            description: 'Author DID if claimed',
          },
          name: {
            type: 'string',
            description: 'Author name',
          },
        },
      },
    },
  },
  PubChiveClaimingGetSuggestions: {
    lexicon: 1,
    id: 'pub.chive.claiming.getSuggestions',
    defs: {
      main: {
        type: 'query',
        description:
          'Get suggested papers for the authenticated user to claim based on their profile',
        parameters: {
          type: 'params',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 50,
              default: 20,
              description: 'Maximum number of suggestions to return',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['papers', 'profileUsed'],
            properties: {
              papers: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.claiming.getSuggestions#suggestedPaper',
                },
                description: 'Suggested papers sorted by match score',
              },
              profileUsed: {
                type: 'ref',
                ref: 'lex:pub.chive.claiming.getSuggestions#profileMetadata',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
        ],
      },
      suggestedPaper: {
        type: 'object',
        required: ['externalId', 'url', 'title', 'authors', 'source', 'matchScore', 'matchReason'],
        properties: {
          externalId: {
            type: 'string',
            description: 'Source-specific identifier',
          },
          url: {
            type: 'string',
            format: 'uri',
            description: 'Full URL to the eprint',
          },
          title: {
            type: 'string',
            description: 'Eprint title',
          },
          abstract: {
            type: 'string',
            description: 'Abstract text',
          },
          authors: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.claiming.getSuggestions#externalAuthor',
            },
            description: 'Author list',
          },
          publicationDate: {
            type: 'string',
            format: 'datetime',
            description: 'Publication date',
          },
          doi: {
            type: 'string',
            description: 'DOI if assigned',
          },
          pdfUrl: {
            type: 'string',
            format: 'uri',
            description: 'URL to PDF',
          },
          categories: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Subject categories',
          },
          source: {
            type: 'string',
            description: 'Source system',
          },
          matchScore: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description: 'Match confidence score (0-100)',
          },
          matchReason: {
            type: 'string',
            description: 'Human-readable match reason',
          },
        },
      },
      externalAuthor: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Author name',
          },
          orcid: {
            type: 'string',
            description: 'ORCID identifier',
          },
          affiliation: {
            type: 'string',
            description: 'Institution affiliation',
          },
          email: {
            type: 'string',
            description: 'Email address',
          },
        },
      },
      profileMetadata: {
        type: 'object',
        required: ['nameVariants', 'hasOrcid', 'hasExternalIds'],
        description: 'Profile data used for matching',
        properties: {
          displayName: {
            type: 'string',
            description: 'User display name',
          },
          nameVariants: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Name variants used for matching',
          },
          hasOrcid: {
            type: 'boolean',
            description: 'Whether user has ORCID linked',
          },
          hasExternalIds: {
            type: 'boolean',
            description: 'Whether user has external authority IDs',
          },
        },
      },
    },
  },
  PubChiveClaimingGetUserClaims: {
    lexicon: 1,
    id: 'pub.chive.claiming.getUserClaims',
    defs: {
      main: {
        type: 'query',
        description: 'Get claims for the authenticated user',
        parameters: {
          type: 'params',
          properties: {
            status: {
              type: 'string',
              knownValues: ['pending', 'approved', 'rejected', 'expired'],
              description: 'Filter by claim status',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Maximum number of claims to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['claims', 'hasMore'],
            properties: {
              claims: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.claiming.getUserClaims#claimWithPaper',
                },
              },
              cursor: {
                type: 'string',
                description: 'Pagination cursor for next page',
              },
              hasMore: {
                type: 'boolean',
                description: 'Whether more results are available',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
        ],
      },
      claimWithPaper: {
        type: 'object',
        required: ['id', 'importId', 'claimantDid', 'status', 'createdAt', 'paper'],
        properties: {
          id: {
            type: 'integer',
            description: 'Claim request ID',
          },
          importId: {
            type: 'integer',
            description: 'ID of the imported eprint',
          },
          claimantDid: {
            type: 'string',
            format: 'did',
            description: 'DID of the claimant',
          },
          status: {
            type: 'string',
            knownValues: ['pending', 'approved', 'rejected', 'expired'],
            description: 'Claim status',
          },
          canonicalUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the canonical record in user PDS',
          },
          rejectionReason: {
            type: 'string',
            description: 'Reason for rejection if rejected',
          },
          reviewedBy: {
            type: 'string',
            format: 'did',
            description: 'DID of the admin who reviewed',
          },
          reviewedAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the claim was reviewed',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the claim was created',
          },
          expiresAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the claim expires',
          },
          paper: {
            type: 'ref',
            ref: 'lex:pub.chive.claiming.getUserClaims#paperDetails',
          },
        },
      },
      paperDetails: {
        type: 'object',
        required: ['source', 'externalId', 'externalUrl', 'title', 'authors'],
        properties: {
          source: {
            type: 'string',
            description: 'Source system',
          },
          externalId: {
            type: 'string',
            description: 'Source-specific identifier',
          },
          externalUrl: {
            type: 'string',
            format: 'uri',
            description: 'URL to the eprint',
          },
          title: {
            type: 'string',
            description: 'Eprint title',
          },
          authors: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.claiming.getUserClaims#externalAuthor',
            },
            description: 'Author list',
          },
          publicationDate: {
            type: 'string',
            description: 'Publication date',
          },
          doi: {
            type: 'string',
            description: 'DOI if assigned',
          },
        },
      },
      externalAuthor: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Author name',
          },
          orcid: {
            type: 'string',
            description: 'ORCID identifier',
          },
          affiliation: {
            type: 'string',
            description: 'Institution affiliation',
          },
          email: {
            type: 'string',
            description: 'Email address',
          },
        },
      },
    },
  },
  PubChiveClaimingRejectClaim: {
    lexicon: 1,
    id: 'pub.chive.claiming.rejectClaim',
    defs: {
      main: {
        type: 'procedure',
        description: 'Reject a pending claim with a reason. Admin only.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['claimId', 'reason'],
            properties: {
              claimId: {
                type: 'integer',
                description: 'ID of the claim request to reject',
              },
              reason: {
                type: 'string',
                minLength: 1,
                maxLength: 500,
                description: 'Rejection reason',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['success'],
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the rejection was successful',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'Forbidden',
          },
          {
            name: 'NotFound',
          },
        ],
      },
    },
  },
  PubChiveClaimingRejectCoauthor: {
    lexicon: 1,
    id: 'pub.chive.claiming.rejectCoauthor',
    defs: {
      main: {
        type: 'procedure',
        description: 'Reject a pending co-author request. Only the PDS owner can reject.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['requestId'],
            properties: {
              requestId: {
                type: 'integer',
                description: 'ID of the co-author request to reject',
              },
              reason: {
                type: 'string',
                maxLength: 500,
                description: 'Optional rejection reason',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['success'],
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the rejection was successful',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'Forbidden',
          },
          {
            name: 'NotFound',
          },
        ],
      },
    },
  },
  PubChiveClaimingRequestCoauthorship: {
    lexicon: 1,
    id: 'pub.chive.claiming.requestCoauthorship',
    defs: {
      main: {
        type: 'procedure',
        description: "Request co-authorship on an existing eprint in another user's PDS",
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['eprintUri', 'eprintOwnerDid', 'claimantName', 'authorIndex', 'authorName'],
            properties: {
              eprintUri: {
                type: 'string',
                format: 'at-uri',
                description: 'AT-URI of the eprint record',
              },
              eprintOwnerDid: {
                type: 'string',
                format: 'did',
                description: 'DID of the PDS owner',
              },
              claimantName: {
                type: 'string',
                minLength: 1,
                maxLength: 200,
                description: 'Display name for the request',
              },
              authorIndex: {
                type: 'integer',
                minimum: 0,
                description: 'Index of the author entry being claimed (0-based)',
              },
              authorName: {
                type: 'string',
                minLength: 1,
                maxLength: 200,
                description: 'Name of the author entry being claimed',
              },
              message: {
                type: 'string',
                maxLength: 1000,
                description: 'Optional message to PDS owner',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['request'],
            properties: {
              request: {
                type: 'ref',
                ref: 'lex:pub.chive.claiming.requestCoauthorship#coauthorRequest',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'NotFound',
          },
          {
            name: 'InvalidRequest',
          },
        ],
      },
      coauthorRequest: {
        type: 'object',
        required: [
          'id',
          'eprintUri',
          'eprintOwnerDid',
          'claimantDid',
          'claimantName',
          'authorIndex',
          'authorName',
          'status',
          'createdAt',
        ],
        properties: {
          id: {
            type: 'integer',
            description: 'Request ID',
          },
          eprintUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the eprint record',
          },
          eprintOwnerDid: {
            type: 'string',
            format: 'did',
            description: 'DID of the PDS owner',
          },
          claimantDid: {
            type: 'string',
            format: 'did',
            description: 'DID of the claimant',
          },
          claimantName: {
            type: 'string',
            description: 'Display name at time of request',
          },
          authorIndex: {
            type: 'integer',
            description: 'Index of the author entry being claimed (0-based)',
          },
          authorName: {
            type: 'string',
            description: 'Name of the author entry being claimed',
          },
          status: {
            type: 'string',
            knownValues: ['pending', 'approved', 'rejected'],
            description: 'Request status',
          },
          message: {
            type: 'string',
            description: 'Message from claimant',
          },
          rejectionReason: {
            type: 'string',
            description: 'Rejection reason if rejected',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the request was created',
          },
          reviewedAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the request was reviewed',
          },
        },
      },
    },
  },
  PubChiveClaimingSearchEprints: {
    lexicon: 1,
    id: 'pub.chive.claiming.searchEprints',
    defs: {
      main: {
        type: 'query',
        description: 'Search external eprint sources for papers to claim',
        parameters: {
          type: 'params',
          properties: {
            query: {
              type: 'string',
              description: 'Title or keyword search query',
            },
            author: {
              type: 'string',
              description: 'Author name to search for',
            },
            sources: {
              type: 'string',
              description: 'Comma-separated list of sources to search',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 50,
              default: 20,
              description: 'Maximum number of results',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['eprints'],
            properties: {
              eprints: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.claiming.searchEprints#externalEprint',
                },
              },
              facets: {
                type: 'ref',
                ref: 'lex:pub.chive.claiming.searchEprints#searchFacets',
              },
            },
          },
        },
        errors: [
          {
            name: 'InvalidRequest',
          },
        ],
      },
      externalEprint: {
        type: 'object',
        required: ['externalId', 'url', 'title', 'authors', 'source'],
        properties: {
          externalId: {
            type: 'string',
            description: 'Source-specific identifier',
          },
          url: {
            type: 'string',
            format: 'uri',
            description: 'Full URL to the eprint',
          },
          title: {
            type: 'string',
            description: 'Eprint title',
          },
          abstract: {
            type: 'string',
            description: 'Abstract text',
          },
          authors: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.claiming.searchEprints#externalAuthor',
            },
            description: 'Author list',
          },
          publicationDate: {
            type: 'string',
            format: 'datetime',
            description: 'Publication date',
          },
          doi: {
            type: 'string',
            description: 'DOI if assigned',
          },
          pdfUrl: {
            type: 'string',
            format: 'uri',
            description: 'URL to PDF',
          },
          categories: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Subject categories',
          },
          source: {
            type: 'string',
            description: 'Source system',
          },
          existingChivePaper: {
            type: 'ref',
            ref: 'lex:pub.chive.claiming.searchEprints#existingChivePaper',
          },
        },
      },
      externalAuthor: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Author name',
          },
          orcid: {
            type: 'string',
            description: 'ORCID identifier',
          },
          affiliation: {
            type: 'string',
            description: 'Institution affiliation',
          },
          email: {
            type: 'string',
            description: 'Email address',
          },
        },
      },
      existingChivePaper: {
        type: 'object',
        required: ['uri', 'title', 'authors', 'createdAt'],
        description: 'Existing Chive paper if this is a duplicate',
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the existing paper',
          },
          title: {
            type: 'string',
            description: 'Paper title',
          },
          authors: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.claiming.searchEprints#existingAuthor',
            },
            description: 'Author list',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the paper was indexed',
          },
        },
      },
      existingAuthor: {
        type: 'object',
        required: ['name'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
            description: 'Author DID if claimed',
          },
          name: {
            type: 'string',
            description: 'Author name',
          },
        },
      },
      searchFacets: {
        type: 'object',
        properties: {
          sources: {
            type: 'unknown',
            description: 'Result counts by source (key: source name, value: count)',
          },
        },
      },
    },
  },
  PubChiveClaimingStartClaim: {
    lexicon: 1,
    id: 'pub.chive.claiming.startClaim',
    defs: {
      main: {
        type: 'procedure',
        description: 'Initiate a claim request for an imported eprint',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['importId'],
            properties: {
              importId: {
                type: 'integer',
                description: 'ID of the imported eprint to claim',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['claim'],
            properties: {
              claim: {
                type: 'ref',
                ref: 'lex:pub.chive.claiming.startClaim#claimRequest',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'NotFound',
          },
          {
            name: 'InvalidRequest',
          },
        ],
      },
      claimRequest: {
        type: 'object',
        required: ['id', 'importId', 'claimantDid', 'status', 'createdAt'],
        properties: {
          id: {
            type: 'integer',
            description: 'Claim request ID',
          },
          importId: {
            type: 'integer',
            description: 'ID of the imported eprint',
          },
          claimantDid: {
            type: 'string',
            format: 'did',
            description: 'DID of the claimant',
          },
          status: {
            type: 'string',
            knownValues: ['pending', 'approved', 'rejected', 'expired'],
            description: 'Claim status',
          },
          canonicalUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the canonical record in user PDS',
          },
          rejectionReason: {
            type: 'string',
            description: 'Reason for rejection if rejected',
          },
          reviewedBy: {
            type: 'string',
            format: 'did',
            description: 'DID of the admin who reviewed',
          },
          reviewedAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the claim was reviewed',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the claim was created',
          },
          expiresAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the claim expires',
          },
        },
      },
    },
  },
  PubChiveClaimingStartClaimFromExternal: {
    lexicon: 1,
    id: 'pub.chive.claiming.startClaimFromExternal',
    defs: {
      main: {
        type: 'procedure',
        description:
          'Start a claim directly from an external search result, importing on demand if needed',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['source', 'externalId'],
            properties: {
              source: {
                type: 'string',
                minLength: 2,
                maxLength: 50,
                description: 'External source (e.g., arxiv, semanticscholar)',
              },
              externalId: {
                type: 'string',
                description: 'Source-specific identifier',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['claim'],
            properties: {
              claim: {
                type: 'ref',
                ref: 'lex:pub.chive.claiming.startClaimFromExternal#claimRequest',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'NotFound',
          },
          {
            name: 'InvalidRequest',
          },
        ],
      },
      claimRequest: {
        type: 'object',
        required: ['id', 'importId', 'claimantDid', 'status', 'createdAt'],
        properties: {
          id: {
            type: 'integer',
            description: 'Claim request ID',
          },
          importId: {
            type: 'integer',
            description: 'ID of the imported eprint',
          },
          claimantDid: {
            type: 'string',
            format: 'did',
            description: 'DID of the claimant',
          },
          status: {
            type: 'string',
            knownValues: ['pending', 'approved', 'rejected', 'expired'],
            description: 'Claim status',
          },
          canonicalUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the canonical record in user PDS',
          },
          rejectionReason: {
            type: 'string',
            description: 'Reason for rejection if rejected',
          },
          reviewedBy: {
            type: 'string',
            format: 'did',
            description: 'DID of the admin who reviewed',
          },
          reviewedAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the claim was reviewed',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the claim was created',
          },
          expiresAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the claim expires',
          },
        },
      },
    },
  },
  PubChiveDiscoveryGetCitations: {
    lexicon: 1,
    id: 'pub.chive.discovery.getCitations',
    defs: {
      main: {
        type: 'query',
        description:
          'Get citation network data for an eprint, including papers that cite it and papers it references (within the Chive index)',
        parameters: {
          type: 'params',
          required: ['uri'],
          properties: {
            uri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of the eprint',
            },
            direction: {
              type: 'string',
              knownValues: ['citing', 'cited-by', 'both'],
              default: 'both',
              description:
                'Citation direction: citing (papers this cites), cited-by (papers citing this), or both',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: 'Maximum number of citations to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor',
            },
            onlyInfluential: {
              type: 'boolean',
              default: false,
              description: 'Only return influential citations',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['eprint', 'counts', 'citations', 'hasMore'],
            properties: {
              eprint: {
                type: 'ref',
                ref: 'lex:pub.chive.discovery.getCitations#eprintRef',
              },
              counts: {
                type: 'ref',
                ref: 'lex:pub.chive.discovery.getCitations#citationCounts',
              },
              citations: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.discovery.getCitations#citation',
                },
              },
              cursor: {
                type: 'string',
                description: 'Pagination cursor for next page',
              },
              hasMore: {
                type: 'boolean',
                description: 'Whether more results are available',
              },
            },
          },
        },
        errors: [
          {
            name: 'NotFound',
          },
          {
            name: 'ServiceUnavailable',
          },
        ],
      },
      eprintRef: {
        type: 'object',
        required: ['uri', 'title'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          title: {
            type: 'string',
          },
        },
      },
      citationCounts: {
        type: 'object',
        required: ['citedByCount', 'referencesCount', 'influentialCitedByCount'],
        properties: {
          citedByCount: {
            type: 'integer',
            minimum: 0,
            description: 'Number of papers citing this eprint',
          },
          referencesCount: {
            type: 'integer',
            minimum: 0,
            description: 'Number of papers this eprint references',
          },
          influentialCitedByCount: {
            type: 'integer',
            minimum: 0,
            description: 'Number of influential citations',
          },
        },
      },
      citation: {
        type: 'object',
        required: ['citingUri', 'citedUri', 'source'],
        properties: {
          citingUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the citing paper',
          },
          citedUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the cited paper',
          },
          isInfluential: {
            type: 'boolean',
            description: 'Whether this is an influential citation',
          },
          source: {
            type: 'string',
            description: 'Source of citation data (e.g., semantic-scholar, openalex)',
          },
          discoveredAt: {
            type: 'string',
            format: 'datetime',
            description: 'When this citation was discovered',
          },
        },
      },
    },
  },
  PubChiveDiscoveryGetEnrichment: {
    lexicon: 1,
    id: 'pub.chive.discovery.getEnrichment',
    defs: {
      main: {
        type: 'query',
        description: 'Get enrichment data for an eprint (citations, concepts, topics)',
        parameters: {
          type: 'params',
          required: ['uri'],
          properties: {
            uri: {
              type: 'string',
              format: 'at-uri',
              description: 'Eprint AT-URI',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['available'],
            properties: {
              enrichment: {
                type: 'ref',
                ref: 'lex:pub.chive.discovery.getEnrichment#enrichmentData',
              },
              available: {
                type: 'boolean',
                description: 'Whether enrichment data is available',
              },
            },
          },
        },
        errors: [
          {
            name: 'NotFound',
          },
        ],
      },
      enrichmentData: {
        type: 'object',
        required: ['uri'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          semanticScholarId: {
            type: 'string',
            description: 'Semantic Scholar paper ID',
          },
          openAlexId: {
            type: 'string',
            description: 'OpenAlex work ID',
          },
          citationCount: {
            type: 'integer',
            description: 'Total citation count',
          },
          influentialCitationCount: {
            type: 'integer',
            description: 'Influential citation count',
          },
          referencesCount: {
            type: 'integer',
            description: 'Number of references',
          },
          concepts: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.discovery.getEnrichment#concept',
            },
          },
          topics: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.discovery.getEnrichment#topic',
            },
          },
          lastEnrichedAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
      concept: {
        type: 'object',
        required: ['id', 'displayName'],
        properties: {
          id: {
            type: 'string',
          },
          displayName: {
            type: 'string',
          },
          wikidataId: {
            type: 'string',
          },
          score: {
            type: 'integer',
            minimum: 0,
            maximum: 1000,
            description: 'Relevance score (scaled by 1000 for 0.0-1.0 range)',
          },
        },
      },
      topic: {
        type: 'object',
        required: ['id', 'displayName'],
        properties: {
          id: {
            type: 'string',
          },
          displayName: {
            type: 'string',
          },
          subfield: {
            type: 'string',
          },
          field: {
            type: 'string',
          },
          domain: {
            type: 'string',
          },
          score: {
            type: 'integer',
            minimum: 0,
            maximum: 1000,
            description: 'Relevance score (scaled by 1000 for 0.0-1.0 range)',
          },
        },
      },
    },
  },
  PubChiveDiscoveryGetForYou: {
    lexicon: 1,
    id: 'pub.chive.discovery.getForYou',
    defs: {
      main: {
        type: 'query',
        description:
          "Get personalized For You feed for the authenticated user. Uses all enabled signals from user's discovery settings.",
        parameters: {
          type: 'params',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 50,
              default: 20,
              description: 'Maximum number of recommendations',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['recommendations', 'hasMore'],
            properties: {
              recommendations: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.discovery.getForYou#recommendedEprint',
                },
              },
              cursor: {
                type: 'string',
                description: 'Pagination cursor for next page',
              },
              hasMore: {
                type: 'boolean',
                description: 'Whether more results are available',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'ServiceUnavailable',
          },
        ],
      },
      recommendedEprint: {
        type: 'object',
        required: ['uri', 'title', 'score', 'explanation'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          title: {
            type: 'string',
          },
          abstract: {
            type: 'string',
          },
          authors: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.discovery.getForYou#author',
            },
          },
          categories: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          publicationDate: {
            type: 'string',
            format: 'datetime',
          },
          score: {
            type: 'integer',
            minimum: 0,
            maximum: 1000,
            description: 'Relevance score (scaled by 1000 for 0.0-1.0 range)',
          },
          explanation: {
            type: 'ref',
            ref: 'lex:pub.chive.discovery.getForYou#recommendationExplanation',
          },
        },
      },
      author: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
          },
        },
      },
      recommendationExplanation: {
        type: 'object',
        required: ['type', 'text', 'weight'],
        properties: {
          type: {
            type: 'string',
            knownValues: ['semantic', 'citation', 'concept', 'collaborator', 'fields', 'trending'],
            description: 'Type of recommendation signal',
          },
          text: {
            type: 'string',
            description: 'Human-readable explanation',
          },
          weight: {
            type: 'integer',
            minimum: 0,
            maximum: 1000,
            description: 'Signal weight (scaled by 1000 for 0.0-1.0 range)',
          },
          data: {
            type: 'ref',
            ref: 'lex:pub.chive.discovery.getForYou#explanationData',
          },
        },
      },
      explanationData: {
        type: 'object',
        properties: {
          similarPaperTitle: {
            type: 'string',
            description: 'Title of paper that triggered similarity match',
          },
          sharedCitations: {
            type: 'integer',
            description: 'Number of shared citations',
          },
          matchingConcepts: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Concepts that matched user interests',
          },
        },
      },
    },
  },
  PubChiveDiscoveryGetRecommendations: {
    lexicon: 1,
    id: 'pub.chive.discovery.getRecommendations',
    defs: {
      main: {
        type: 'query',
        description:
          "Get personalized paper recommendations based on research profile, claimed papers, and interaction history. Supports graph-based recommendations via the 'graph' signal.",
        parameters: {
          type: 'params',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 50,
              default: 20,
              description: 'Maximum number of recommendations',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor',
            },
            signals: {
              type: 'array',
              items: {
                type: 'string',
                knownValues: ['fields', 'citations', 'collaborators', 'trending', 'graph'],
              },
              description:
                "Signal types to include. 'graph' adds co-citation and PageRank-based recommendations.",
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['recommendations', 'hasMore'],
            properties: {
              recommendations: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.discovery.getRecommendations#recommendedEprint',
                },
              },
              cursor: {
                type: 'string',
                description: 'Pagination cursor for next page',
              },
              hasMore: {
                type: 'boolean',
                description: 'Whether more results are available',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'ServiceUnavailable',
          },
        ],
      },
      recommendedEprint: {
        type: 'object',
        required: ['uri', 'title', 'score', 'explanation'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          title: {
            type: 'string',
          },
          abstract: {
            type: 'string',
          },
          authors: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.discovery.getRecommendations#author',
            },
          },
          categories: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          publicationDate: {
            type: 'string',
            format: 'datetime',
          },
          score: {
            type: 'integer',
            minimum: 0,
            maximum: 1000,
            description: 'Relevance score (scaled by 1000 for 0.0-1.0 range)',
          },
          explanation: {
            type: 'ref',
            ref: 'lex:pub.chive.discovery.getRecommendations#recommendationExplanation',
          },
        },
      },
      author: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
          },
        },
      },
      recommendationExplanation: {
        type: 'object',
        required: ['type', 'text', 'weight'],
        properties: {
          type: {
            type: 'string',
            knownValues: ['semantic', 'citation', 'concept', 'collaborator', 'fields', 'trending'],
            description: 'Type of recommendation signal',
          },
          text: {
            type: 'string',
            description: 'Human-readable explanation',
          },
          weight: {
            type: 'integer',
            minimum: 0,
            maximum: 1000,
            description: 'Signal weight (scaled by 1000 for 0.0-1.0 range)',
          },
          data: {
            type: 'ref',
            ref: 'lex:pub.chive.discovery.getRecommendations#explanationData',
          },
        },
      },
      explanationData: {
        type: 'object',
        properties: {
          similarPaperTitle: {
            type: 'string',
            description: 'Title of paper that triggered similarity match',
          },
          sharedCitations: {
            type: 'integer',
            description: 'Number of shared citations',
          },
          matchingConcepts: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Concepts that matched user interests',
          },
        },
      },
    },
  },
  PubChiveDiscoveryGetSimilar: {
    lexicon: 1,
    id: 'pub.chive.discovery.getSimilar',
    defs: {
      main: {
        type: 'query',
        description:
          'Get related papers for an eprint based on citation patterns, semantic similarity, and topic overlap. Supports graph-based analysis including co-citation and bibliographic coupling.',
        parameters: {
          type: 'params',
          required: ['uri'],
          properties: {
            uri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of the eprint',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 20,
              default: 5,
              description: 'Maximum number of similar papers',
            },
            includeTypes: {
              type: 'array',
              items: {
                type: 'string',
                knownValues: [
                  'semantic',
                  'citation',
                  'topic',
                  'author',
                  'co-citation',
                  'bibliographic-coupling',
                ],
              },
              description:
                "Types of relationships to include. 'co-citation' and 'bibliographic-coupling' use graph analysis.",
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['eprint', 'related'],
            properties: {
              eprint: {
                type: 'ref',
                ref: 'lex:pub.chive.discovery.getSimilar#eprintRef',
              },
              related: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.discovery.getSimilar#relatedEprint',
                },
              },
            },
          },
        },
        errors: [
          {
            name: 'NotFound',
          },
          {
            name: 'ServiceUnavailable',
          },
        ],
      },
      eprintRef: {
        type: 'object',
        required: ['uri', 'title'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          title: {
            type: 'string',
          },
        },
      },
      relatedEprint: {
        type: 'object',
        required: ['uri', 'title', 'score', 'relationshipType', 'explanation'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          title: {
            type: 'string',
          },
          abstract: {
            type: 'string',
          },
          authors: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.discovery.getSimilar#author',
            },
          },
          categories: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          publicationDate: {
            type: 'string',
            format: 'datetime',
          },
          score: {
            type: 'integer',
            minimum: 0,
            maximum: 1000,
            description: 'Similarity score (scaled by 1000 for 0.0-1.0 range)',
          },
          relationshipType: {
            type: 'string',
            knownValues: [
              'cites',
              'cited-by',
              'co-cited',
              'semantically-similar',
              'same-author',
              'same-topic',
              'bibliographic-coupling',
            ],
            description: 'Type of relationship to the source eprint',
          },
          explanation: {
            type: 'string',
            description: 'Human-readable explanation of the relationship',
          },
          sharedReferences: {
            type: 'integer',
            minimum: 0,
            description: 'Number of shared references (for bibliographic coupling)',
          },
          sharedCiters: {
            type: 'integer',
            minimum: 0,
            description: 'Number of papers that cite both (for co-citation)',
          },
        },
      },
      author: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
          },
        },
      },
    },
  },
  PubChiveDiscoveryRecordInteraction: {
    lexicon: 1,
    id: 'pub.chive.discovery.recordInteraction',
    defs: {
      main: {
        type: 'procedure',
        description:
          'Record a user interaction with a recommendation for the feedback loop. Used to improve personalization over time.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['eprintUri', 'type'],
            properties: {
              eprintUri: {
                type: 'string',
                format: 'at-uri',
                description: 'AT-URI of the eprint',
              },
              type: {
                type: 'string',
                knownValues: ['view', 'click', 'endorse', 'dismiss', 'claim'],
                description:
                  'Type of interaction: view (viewed detail page), click (clicked recommendation), endorse (endorsed paper), dismiss (dismissed recommendation), claim (claimed authorship)',
              },
              recommendationId: {
                type: 'string',
                description: 'ID of the recommendation that led to this interaction',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['recorded'],
            properties: {
              recorded: {
                type: 'boolean',
                description: 'Whether the interaction was successfully recorded',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
        ],
      },
    },
  },
  PubChiveDiscoverySettings: {
    lexicon: 1,
    id: 'pub.chive.discovery.settings',
    defs: {
      forYouSignals: {
        type: 'object',
        description: 'Configuration for For You feed signals',
        properties: {
          fields: {
            type: 'boolean',
            description: "Show papers from user's research fields",
            default: true,
          },
          citations: {
            type: 'boolean',
            description: "Show papers citing user's work",
            default: true,
          },
          collaborators: {
            type: 'boolean',
            description: 'Show papers from collaborators',
            default: true,
          },
          trending: {
            type: 'boolean',
            description: "Show trending papers in user's fields",
            default: true,
          },
        },
      },
      relatedPapersSignals: {
        type: 'object',
        description: 'Configuration for related papers panel signals',
        properties: {
          citations: {
            type: 'boolean',
            description: 'Show citation-based relationships',
            default: true,
          },
          topics: {
            type: 'boolean',
            description: 'Show topic/concept-based relationships',
            default: true,
          },
        },
      },
      main: {
        type: 'record',
        description: 'User discovery preferences for personalized recommendations',
        key: 'self',
        record: {
          type: 'object',
          properties: {
            enablePersonalization: {
              type: 'boolean',
              description: 'Enable personalized recommendations based on profile',
              default: true,
            },
            enableForYouFeed: {
              type: 'boolean',
              description: 'Show the For You personalized feed',
              default: true,
            },
            forYouSignals: {
              type: 'ref',
              ref: 'lex:pub.chive.discovery.settings#forYouSignals',
              description: 'Signals to use for For You recommendations',
            },
            relatedPapersSignals: {
              type: 'ref',
              ref: 'lex:pub.chive.discovery.settings#relatedPapersSignals',
              description: 'Signals to use for related papers',
            },
            citationNetworkDisplay: {
              type: 'string',
              description: 'How to display citation network',
              knownValues: ['hidden', 'preview', 'expanded'],
              default: 'preview',
            },
            showRecommendationReasons: {
              type: 'boolean',
              description: 'Show explanations for why papers are recommended',
              default: true,
            },
          },
        },
      },
    },
  },
  PubChiveEndorsementGetSummary: {
    lexicon: 1,
    id: 'pub.chive.endorsement.getSummary',
    defs: {
      main: {
        type: 'query',
        description: 'Get endorsement summary (counts by contribution type) for an eprint',
        parameters: {
          type: 'params',
          required: ['eprintUri'],
          properties: {
            eprintUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of the eprint',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['total', 'endorserCount', 'byType'],
            properties: {
              total: {
                type: 'integer',
                minimum: 0,
                description: 'Total endorsement count',
              },
              endorserCount: {
                type: 'integer',
                minimum: 0,
                description: 'Unique endorser count',
              },
              byType: {
                type: 'ref',
                ref: 'lex:pub.chive.endorsement.getSummary#endorsementCountByType',
                description: 'Count by contribution type',
              },
            },
          },
        },
        errors: [],
      },
      endorsementCountByType: {
        type: 'object',
        description: 'Map of contribution type slug to endorsement count',
        properties: {},
      },
    },
  },
  PubChiveEndorsementGetUserEndorsement: {
    lexicon: 1,
    id: 'pub.chive.endorsement.getUserEndorsement',
    defs: {
      main: {
        type: 'query',
        description: "Get a user's endorsement for a specific eprint",
        parameters: {
          type: 'params',
          required: ['eprintUri', 'userDid'],
          properties: {
            eprintUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of the eprint',
            },
            userDid: {
              type: 'string',
              format: 'did',
              description: 'DID of the user',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:pub.chive.endorsement.getUserEndorsement#endorsementView',
          },
        },
        errors: [
          {
            name: 'NotFound',
          },
        ],
      },
      endorsementView: {
        type: 'object',
        description: 'View of an endorsement',
        required: ['uri', 'cid', 'eprintUri', 'endorser', 'contributions', 'createdAt'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'Endorsement AT-URI',
          },
          cid: {
            type: 'string',
            description: 'Content identifier',
          },
          eprintUri: {
            type: 'string',
            format: 'at-uri',
            description: 'Endorsed eprint AT-URI',
          },
          endorser: {
            type: 'ref',
            ref: 'lex:pub.chive.endorsement.getUserEndorsement#authorRef',
          },
          contributions: {
            type: 'array',
            minLength: 1,
            items: {
              type: 'string',
              knownValues: [
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
              ],
            },
            description: 'Contribution types being endorsed',
          },
          comment: {
            type: 'string',
            maxLength: 1000,
            description: 'Optional comment',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'Creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'datetime',
            description: 'Last update timestamp',
          },
        },
      },
      authorRef: {
        type: 'object',
        required: ['did'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
          },
          avatar: {
            type: 'string',
            format: 'uri',
          },
        },
      },
    },
  },
  PubChiveEndorsementListForEprint: {
    lexicon: 1,
    id: 'pub.chive.endorsement.listForEprint',
    defs: {
      main: {
        type: 'query',
        description: 'List endorsements for a specific eprint with optional filtering',
        parameters: {
          type: 'params',
          required: ['eprintUri'],
          properties: {
            eprintUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of the eprint',
            },
            contributionType: {
              type: 'string',
              knownValues: [
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
              ],
              description: 'Filter by contribution type',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Maximum number of results to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor for next page',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['endorsements', 'hasMore'],
            properties: {
              endorsements: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.endorsement.listForEprint#endorsementView',
                },
                description: 'List of endorsements',
              },
              summary: {
                type: 'ref',
                ref: 'lex:pub.chive.endorsement.listForEprint#endorsementSummary',
                description: 'Aggregated summary',
              },
              cursor: {
                type: 'string',
                description: 'Cursor for next page',
              },
              hasMore: {
                type: 'boolean',
                description: 'Whether more results are available',
              },
              total: {
                type: 'integer',
                description: 'Total number of endorsements',
              },
            },
          },
        },
        errors: [],
      },
      endorsementView: {
        type: 'object',
        description: 'View of an endorsement',
        required: ['uri', 'cid', 'eprintUri', 'endorser', 'contributions', 'createdAt'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'Endorsement AT-URI',
          },
          cid: {
            type: 'string',
            description: 'Content identifier',
          },
          eprintUri: {
            type: 'string',
            format: 'at-uri',
            description: 'Endorsed eprint AT-URI',
          },
          endorser: {
            type: 'ref',
            ref: 'lex:pub.chive.endorsement.listForEprint#authorRef',
          },
          contributions: {
            type: 'array',
            minLength: 1,
            items: {
              type: 'string',
              knownValues: [
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
              ],
            },
            description: 'Contribution types being endorsed',
          },
          comment: {
            type: 'string',
            maxLength: 1000,
            description: 'Optional comment',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'Creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'datetime',
            description: 'Last update timestamp',
          },
        },
      },
      authorRef: {
        type: 'object',
        required: ['did'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
          },
          avatar: {
            type: 'string',
            format: 'uri',
          },
        },
      },
      endorsementSummary: {
        type: 'object',
        required: ['total', 'endorserCount', 'byType'],
        properties: {
          total: {
            type: 'integer',
            minimum: 0,
            description: 'Total endorsement count',
          },
          endorserCount: {
            type: 'integer',
            minimum: 0,
            description: 'Unique endorser count',
          },
          byType: {
            type: 'ref',
            ref: 'lex:pub.chive.endorsement.listForEprint#endorsementCountByType',
            description: 'Count by contribution type',
          },
        },
      },
      endorsementCountByType: {
        type: 'object',
        description: 'Map of contribution type slug to endorsement count',
        properties: {},
      },
    },
  },
  PubChiveEprintAuthorContribution: {
    lexicon: 1,
    id: 'pub.chive.eprint.authorContribution',
    defs: {
      affiliation: {
        type: 'object',
        description: 'Author affiliation with optional institution node reference',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Organization name (display fallback)',
            maxLength: 300,
          },
          institutionUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI to institution node in knowledge graph (subkind=institution)',
          },
          rorId: {
            type: 'string',
            description: 'ROR ID (e.g., https://ror.org/02mhbdp94)',
            maxLength: 100,
          },
          department: {
            type: 'string',
            description: 'Department or division within organization',
            maxLength: 200,
          },
        },
      },
      contribution: {
        type: 'object',
        description: 'Author contribution with type and degree node references',
        required: ['typeUri'],
        properties: {
          typeUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI to contribution type node (subkind=contribution-type)',
          },
          typeSlug: {
            type: 'string',
            description: "Contribution type slug for display fallback (e.g., 'conceptualization')",
            maxLength: 50,
          },
          degreeUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI to contribution degree node (subkind=contribution-degree)',
          },
          degreeSlug: {
            type: 'string',
            knownValues: ['lead', 'equal', 'supporting'],
            description: 'Contribution degree slug for display fallback',
            default: 'equal',
          },
        },
      },
      main: {
        type: 'object',
        description: 'Author entry with full contribution metadata',
        required: ['name', 'order'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
            description: 'Author DID if they have an ATProto account',
          },
          name: {
            type: 'string',
            description: 'Author display name (required even if DID present)',
            maxLength: 200,
          },
          orcid: {
            type: 'string',
            description: 'ORCID identifier (format: 0000-0000-0000-000X)',
            maxLength: 19,
          },
          email: {
            type: 'string',
            description: 'Contact email (for external authors)',
            maxLength: 254,
          },
          order: {
            type: 'integer',
            minimum: 1,
            description: 'Position in author list (1-indexed)',
          },
          affiliations: {
            type: 'array',
            description: 'Author affiliations',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.eprint.authorContribution#affiliation',
            },
            maxLength: 10,
          },
          contributions: {
            type: 'array',
            description: 'CRediT-based contribution types',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.eprint.authorContribution#contribution',
            },
            maxLength: 14,
          },
          isCorrespondingAuthor: {
            type: 'boolean',
            description: 'Whether this is a corresponding author',
            default: false,
          },
          isHighlighted: {
            type: 'boolean',
            description: 'Whether this author is highlighted (co-first, co-last)',
            default: false,
          },
        },
      },
    },
  },
  PubChiveEprintGetSubmission: {
    lexicon: 1,
    id: 'pub.chive.eprint.getSubmission',
    defs: {
      main: {
        type: 'query',
        description: 'Retrieve an eprint submission by URI',
        parameters: {
          type: 'params',
          required: ['uri'],
          properties: {
            uri: {
              type: 'string',
              format: 'at-uri',
              description: 'Eprint URI',
            },
            cid: {
              type: 'string',
              format: 'cid',
              description: 'Specific version CID',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['uri', 'cid', 'value', 'indexedAt', 'pdsUrl'],
            properties: {
              uri: {
                type: 'string',
                format: 'at-uri',
              },
              cid: {
                type: 'string',
                format: 'cid',
              },
              value: {
                type: 'ref',
                ref: 'lex:pub.chive.eprint.submission',
              },
              indexedAt: {
                type: 'string',
                format: 'datetime',
              },
              pdsUrl: {
                type: 'string',
                description: 'Source PDS URL (transparency)',
              },
            },
          },
        },
        errors: [
          {
            name: 'NotFound',
          },
          {
            name: 'Stale',
            description: 'Indexed data is stale, refresh in progress',
          },
        ],
      },
    },
  },
  PubChiveEprintListByAuthor: {
    lexicon: 1,
    id: 'pub.chive.eprint.listByAuthor',
    defs: {
      main: {
        type: 'query',
        description: 'List eprints by author DID',
        parameters: {
          type: 'params',
          required: ['did'],
          properties: {
            did: {
              type: 'string',
              format: 'did',
              description: 'Author DID',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 25,
            },
            cursor: {
              type: 'string',
            },
            sortBy: {
              type: 'string',
              knownValues: ['indexedAt', 'publishedAt', 'updatedAt'],
              default: 'indexedAt',
            },
            sortOrder: {
              type: 'string',
              knownValues: ['asc', 'desc'],
              default: 'desc',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['eprints'],
            properties: {
              eprints: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.eprint.listByAuthor#eprintSummary',
                },
              },
              cursor: {
                type: 'string',
              },
              total: {
                type: 'integer',
              },
            },
          },
        },
        errors: [
          {
            name: 'NotFound',
          },
        ],
      },
      eprintSummary: {
        type: 'object',
        required: ['uri', 'title', 'indexedAt'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
          title: {
            type: 'string',
          },
          authors: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.eprint.listByAuthor#authorRef',
            },
          },
          abstract: {
            type: 'string',
            maxLength: 500,
          },
          fields: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          publishedAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
      authorRef: {
        type: 'object',
        required: ['did'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
          },
        },
      },
    },
  },
  PubChiveEprintSearchSubmissions: {
    lexicon: 1,
    id: 'pub.chive.eprint.searchSubmissions',
    defs: {
      main: {
        type: 'query',
        description: 'Search preprints with faceted filters using knowledge graph dimensions',
        parameters: {
          type: 'params',
          properties: {
            q: {
              type: 'string',
              description: 'Search query. If omitted, returns recent eprints (browsing mode)',
            },
            author: {
              type: 'string',
              format: 'did',
              description: 'Filter by author DID',
            },
            fieldUris: {
              type: 'array',
              description: 'Filter by field node URIs (subkind=field)',
              items: {
                type: 'string',
                format: 'at-uri',
              },
            },
            topicUris: {
              type: 'array',
              description: 'Filter by topic node URIs (subkind=topic)',
              items: {
                type: 'string',
                format: 'at-uri',
              },
            },
            facetUris: {
              type: 'array',
              description: 'Filter by facet node URIs (subkind=facet)',
              items: {
                type: 'string',
                format: 'at-uri',
              },
            },
            paperTypeUri: {
              type: 'string',
              format: 'at-uri',
              description: 'Filter by paper type node URI (subkind=paper-type)',
            },
            publicationStatusUri: {
              type: 'string',
              format: 'at-uri',
              description: 'Filter by publication status node URI (subkind=publication-status)',
            },
            dateFrom: {
              type: 'string',
              format: 'datetime',
              description: 'Filter by submission date (from)',
            },
            dateTo: {
              type: 'string',
              format: 'datetime',
              description: 'Filter by submission date (to)',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 25,
            },
            cursor: {
              type: 'string',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['hits'],
            properties: {
              hits: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.eprint.searchSubmissions#searchHit',
                },
              },
              cursor: {
                type: 'string',
              },
              total: {
                type: 'integer',
                description: 'Total number of matching documents',
              },
              facetAggregations: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.eprint.searchSubmissions#facetAggregation',
                },
              },
            },
          },
        },
      },
      searchHit: {
        type: 'object',
        description: 'A search result hit',
        required: ['uri', 'score'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the matched eprint',
          },
          score: {
            type: 'integer',
            minimum: 0,
            description: 'Relevance score (scaled by 1000 for precision)',
          },
          highlight: {
            type: 'ref',
            ref: 'lex:pub.chive.eprint.searchSubmissions#highlightResult',
          },
        },
      },
      highlightResult: {
        type: 'object',
        description: 'Highlighted text fragments with search matches',
        properties: {
          title: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Title fragments with <em> highlighting',
          },
          abstract: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Abstract fragments with <em> highlighting',
          },
        },
      },
      facetAggregation: {
        type: 'object',
        description: 'Aggregation for a facet dimension',
        required: ['dimension', 'subkind', 'values'],
        properties: {
          dimension: {
            type: 'string',
            description: "Dimension identifier (e.g., 'field', 'topic', 'paperType')",
          },
          subkind: {
            type: 'string',
            description: "Subkind slug for the dimension's nodes",
          },
          label: {
            type: 'string',
            description: 'Display label for the dimension',
          },
          values: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.eprint.searchSubmissions#facetValue',
            },
          },
        },
      },
      facetValue: {
        type: 'object',
        description: 'A facet value with node reference',
        required: ['uri', 'label', 'count'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the knowledge graph node',
          },
          slug: {
            type: 'string',
            description: 'Node slug for URL generation',
          },
          label: {
            type: 'string',
            description: 'Display label',
          },
          count: {
            type: 'integer',
            description: 'Number of documents with this facet value',
          },
        },
      },
    },
  },
  PubChiveEprintSubmission: {
    lexicon: 1,
    id: 'pub.chive.eprint.submission',
    defs: {
      main: {
        type: 'record',
        description: 'A scholarly eprint submission record',
        key: 'tid',
        record: {
          type: 'object',
          required: [
            'title',
            'abstract',
            'document',
            'licenseSlug',
            'authors',
            'submittedBy',
            'createdAt',
          ],
          properties: {
            title: {
              type: 'string',
              description: 'Eprint title',
              maxLength: 500,
            },
            abstract: {
              type: 'array',
              description: 'Rich abstract with text and node references',
              items: {
                type: 'union',
                refs: [
                  'lex:pub.chive.eprint.submission#textItem',
                  'lex:pub.chive.eprint.submission#nodeRefItem',
                ],
              },
              maxLength: 100,
            },
            abstractPlainText: {
              type: 'string',
              description: 'Plain text abstract for search indexing (auto-generated)',
              maxLength: 10000,
            },
            document: {
              type: 'blob',
              description:
                'Primary manuscript document (PDF, DOCX, HTML, Markdown, LaTeX, or Jupyter)',
              accept: [
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/html',
                'text/markdown',
                'text/x-markdown',
                'text/x-tex',
                'application/x-tex',
                'application/x-ipynb+json',
                'application/vnd.oasis.opendocument.text',
                'application/rtf',
                'application/epub+zip',
                'text/plain',
              ],
              maxSize: 52428800,
            },
            documentFormatUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI to document format node (subkind=document-format)',
            },
            documentFormatSlug: {
              type: 'string',
              description: 'Document format slug for display fallback',
              knownValues: [
                'pdf',
                'docx',
                'html',
                'markdown',
                'latex',
                'jupyter',
                'odt',
                'rtf',
                'epub',
                'txt',
              ],
            },
            supplementaryMaterials: {
              type: 'array',
              description: 'Additional materials (appendices, data, code, figures)',
              items: {
                type: 'ref',
                ref: 'lex:pub.chive.eprint.submission#supplementaryItem',
              },
              maxLength: 50,
            },
            authors: {
              type: 'array',
              description: 'All authors with contributions, affiliations, and metadata',
              items: {
                type: 'ref',
                ref: 'lex:pub.chive.eprint.authorContribution',
              },
              minLength: 1,
              maxLength: 100,
            },
            submittedBy: {
              type: 'string',
              format: 'did',
              description: 'DID of the human user who submitted this eprint',
            },
            paperDid: {
              type: 'string',
              format: 'did',
              description: "DID of the paper's own account (if paper has its own PDS)",
            },
            keywords: {
              type: 'array',
              description: 'Author-provided keywords',
              items: {
                type: 'string',
                maxLength: 100,
              },
              maxLength: 20,
            },
            fieldUris: {
              type: 'array',
              description: 'Field node references (subkind=field)',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              maxLength: 10,
            },
            topicUris: {
              type: 'array',
              description: 'Topic node references (subkind=topic)',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              maxLength: 20,
            },
            facetUris: {
              type: 'array',
              description: 'Facet node references (subkind=facet)',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              maxLength: 30,
            },
            version: {
              type: 'integer',
              description: 'Version number (1-indexed)',
              minimum: 1,
            },
            previousVersion: {
              type: 'string',
              format: 'at-uri',
              description: 'Previous version URI',
            },
            licenseUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI to license node (subkind=license)',
            },
            licenseSlug: {
              type: 'string',
              description: 'SPDX license identifier for display fallback',
              knownValues: ['CC-BY-4.0', 'CC-BY-SA-4.0', 'CC0-1.0', 'MIT', 'Apache-2.0'],
            },
            publicationStatusUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI to publication status node (subkind=publication-status)',
            },
            publicationStatusSlug: {
              type: 'string',
              description: 'Publication status slug for display fallback',
              knownValues: [
                'preprint',
                'under_review',
                'revision_requested',
                'accepted',
                'in_press',
                'published',
                'retracted',
              ],
              default: 'preprint',
            },
            paperTypeUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI to paper type node (subkind=paper-type)',
            },
            paperTypeSlug: {
              type: 'string',
              description: 'Paper type slug for display fallback',
              knownValues: [
                'original-research',
                'review',
                'meta-analysis',
                'case-study',
                'commentary',
                'tutorial',
                'survey',
              ],
            },
            publishedVersion: {
              type: 'ref',
              ref: 'lex:pub.chive.eprint.submission#publishedVersion',
              description: 'Link to the published version (Version of Record)',
            },
            relatedWorks: {
              type: 'array',
              description: 'Related eprints, datasets, software, and prior versions',
              items: {
                type: 'ref',
                ref: 'lex:pub.chive.eprint.submission#relatedWork',
              },
              maxLength: 50,
            },
            externalIds: {
              type: 'ref',
              ref: 'lex:pub.chive.eprint.submission#externalIds',
              description: 'External persistent identifiers',
            },
            repositories: {
              type: 'ref',
              ref: 'lex:pub.chive.eprint.submission#repositories',
              description: 'Linked code, data, and materials repositories',
            },
            funding: {
              type: 'array',
              description: 'Funding sources and grants',
              items: {
                type: 'ref',
                ref: 'lex:pub.chive.eprint.submission#fundingSource',
              },
              maxLength: 20,
            },
            conferencePresentation: {
              type: 'ref',
              ref: 'lex:pub.chive.eprint.submission#conferencePresentation',
              description: 'Conference where this work was presented',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
              description: 'Creation timestamp',
            },
          },
        },
      },
      supplementaryItem: {
        type: 'object',
        description: 'A supplementary material item with metadata',
        required: ['blob', 'label'],
        properties: {
          blob: {
            type: 'blob',
            description: 'Supplementary file blob reference',
            maxSize: 104857600,
          },
          label: {
            type: 'string',
            description: "User-provided label (e.g., 'Appendix A', 'Figure S1')",
            maxLength: 200,
          },
          description: {
            type: 'string',
            description: 'Description of the supplementary material',
            maxLength: 1000,
          },
          categoryUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI to supplementary category node (subkind=supplementary-category)',
          },
          categorySlug: {
            type: 'string',
            description: 'Category slug for display fallback',
            knownValues: [
              'appendix',
              'figure',
              'table',
              'dataset',
              'code',
              'notebook',
              'video',
              'audio',
              'presentation',
              'protocol',
              'questionnaire',
              'other',
            ],
          },
          detectedFormat: {
            type: 'string',
            description: 'Auto-detected file format',
          },
          order: {
            type: 'integer',
            description: 'Display order (1-indexed)',
            minimum: 1,
          },
        },
      },
      publishedVersion: {
        type: 'object',
        description: 'Link to the published version (Version of Record)',
        properties: {
          doi: {
            type: 'string',
            description: 'DOI of the published version (e.g., 10.1234/example)',
          },
          url: {
            type: 'string',
            format: 'uri',
            description: 'URL to the published version',
          },
          publishedAt: {
            type: 'string',
            format: 'datetime',
            description: 'Publication date',
          },
          journal: {
            type: 'string',
            description: 'Journal name',
            maxLength: 500,
          },
          journalAbbreviation: {
            type: 'string',
            description: 'Journal abbreviation',
            maxLength: 100,
          },
          journalIssn: {
            type: 'string',
            description: 'Journal ISSN',
          },
          publisher: {
            type: 'string',
            description: 'Publisher name',
            maxLength: 300,
          },
          volume: {
            type: 'string',
            description: 'Volume number',
            maxLength: 50,
          },
          issue: {
            type: 'string',
            description: 'Issue number',
            maxLength: 50,
          },
          pages: {
            type: 'string',
            description: 'Page range',
            maxLength: 50,
          },
          articleNumber: {
            type: 'string',
            description: 'Article number',
            maxLength: 50,
          },
          eLocationId: {
            type: 'string',
            description: 'Electronic location ID for online-only journals',
          },
          accessType: {
            type: 'string',
            description: 'Open access status',
            knownValues: ['open_access', 'green_oa', 'gold_oa', 'hybrid_oa', 'bronze_oa', 'closed'],
          },
          licenseUrl: {
            type: 'string',
            format: 'uri',
            description: 'License URL',
          },
        },
      },
      relatedWork: {
        type: 'object',
        description: 'A related work with DataCite-compatible relation type',
        required: ['identifier', 'identifierType', 'relationType'],
        properties: {
          identifier: {
            type: 'string',
            description: 'Identifier value',
          },
          identifierType: {
            type: 'string',
            description: 'Type of identifier',
            knownValues: [
              'doi',
              'arxiv',
              'pmid',
              'pmcid',
              'url',
              'urn',
              'handle',
              'isbn',
              'issn',
              'at-uri',
            ],
          },
          relationType: {
            type: 'string',
            description: 'DataCite-compatible relation type',
            knownValues: [
              'isPreprintOf',
              'hasPreprint',
              'isVersionOf',
              'hasVersion',
              'isNewVersionOf',
              'isPreviousVersionOf',
              'isPartOf',
              'hasPart',
              'references',
              'isReferencedBy',
              'isSupplementTo',
              'isSupplementedBy',
              'isContinuedBy',
              'continues',
              'isDocumentedBy',
              'documents',
              'isCompiledBy',
              'compiles',
              'isVariantFormOf',
              'isOriginalFormOf',
              'isIdenticalTo',
              'isReviewedBy',
              'reviews',
              'isDerivedFrom',
              'isSourceOf',
              'isRequiredBy',
              'requires',
              'isObsoletedBy',
              'obsoletes',
            ],
          },
          title: {
            type: 'string',
            description: 'Title of the related work',
          },
          description: {
            type: 'string',
            description: 'Description of the relation',
          },
        },
      },
      externalIds: {
        type: 'object',
        description: 'External persistent identifiers',
        properties: {
          arxivId: {
            type: 'string',
            description: 'arXiv identifier',
          },
          pmid: {
            type: 'string',
            description: 'PubMed ID',
          },
          pmcid: {
            type: 'string',
            description: 'PubMed Central ID',
          },
          ssrnId: {
            type: 'string',
            description: 'SSRN identifier',
          },
          osf: {
            type: 'string',
            description: 'OSF identifier',
          },
          zenodoDoi: {
            type: 'string',
            description: 'Zenodo DOI',
          },
          openAlexId: {
            type: 'string',
            description: 'OpenAlex identifier',
          },
          semanticScholarId: {
            type: 'string',
            description: 'Semantic Scholar identifier',
          },
          coreSid: {
            type: 'string',
            description: 'CORE identifier',
          },
          magId: {
            type: 'string',
            description: 'Microsoft Academic Graph ID (legacy)',
          },
        },
      },
      repositories: {
        type: 'object',
        description: 'Linked code, data, and materials repositories',
        properties: {
          code: {
            type: 'array',
            description: 'Code repositories',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.eprint.submission#codeRepository',
            },
            maxLength: 10,
          },
          data: {
            type: 'array',
            description: 'Data repositories',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.eprint.submission#dataRepository',
            },
            maxLength: 20,
          },
          preregistration: {
            type: 'ref',
            ref: 'lex:pub.chive.eprint.submission#preregistration',
            description: 'Pre-registration or registered report link',
          },
          protocols: {
            type: 'array',
            description: 'Protocol links',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.eprint.submission#protocol',
            },
            maxLength: 10,
          },
          materials: {
            type: 'array',
            description: 'Physical materials, reagents, plasmids, etc.',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.eprint.submission#material',
            },
            maxLength: 20,
          },
        },
      },
      codeRepository: {
        type: 'object',
        description: 'A code repository link',
        properties: {
          url: {
            type: 'string',
            format: 'uri',
            description: 'Repository URL',
          },
          platformUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI to platform node (subkind=platform-code)',
          },
          platformSlug: {
            type: 'string',
            description: 'Platform slug for display fallback',
            knownValues: [
              'github',
              'gitlab',
              'bitbucket',
              'huggingface',
              'paperswithcode',
              'codeberg',
              'sourcehut',
              'software_heritage',
              'colab',
              'kaggle',
              'other',
            ],
          },
          label: {
            type: 'string',
            description: 'User-provided label',
          },
          archiveUrl: {
            type: 'string',
            format: 'uri',
            description: 'Software Heritage archive URL',
          },
          swhid: {
            type: 'string',
            description: 'Software Heritage Identifier',
          },
        },
      },
      dataRepository: {
        type: 'object',
        description: 'A data repository link',
        properties: {
          url: {
            type: 'string',
            format: 'uri',
            description: 'Repository URL',
          },
          doi: {
            type: 'string',
            description: 'Dataset DOI',
          },
          platformUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI to platform node (subkind=platform-data)',
          },
          platformSlug: {
            type: 'string',
            description: 'Platform slug for display fallback',
            knownValues: [
              'huggingface',
              'zenodo',
              'figshare',
              'dryad',
              'osf',
              'dataverse',
              'mendeley_data',
              'kaggle',
              'wandb',
              'other',
            ],
          },
          label: {
            type: 'string',
            description: 'User-provided label',
          },
          accessStatement: {
            type: 'string',
            description: 'Data availability statement',
          },
        },
      },
      preregistration: {
        type: 'object',
        description: 'Pre-registration or registered report link',
        properties: {
          url: {
            type: 'string',
            format: 'uri',
            description: 'Pre-registration URL',
          },
          platformUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI to platform node (subkind=platform-preregistration)',
          },
          platformSlug: {
            type: 'string',
            description: 'Platform slug for display fallback',
            knownValues: ['osf', 'aspredicted', 'clinicaltrials', 'prospero', 'other'],
          },
          registrationDate: {
            type: 'string',
            format: 'datetime',
            description: 'Registration date',
          },
        },
      },
      protocol: {
        type: 'object',
        description: 'A protocol link',
        properties: {
          url: {
            type: 'string',
            format: 'uri',
            description: 'Protocol URL',
          },
          doi: {
            type: 'string',
            description: 'Protocol DOI',
          },
          platformUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI to platform node (subkind=platform-protocol)',
          },
          platformSlug: {
            type: 'string',
            description: 'Platform slug for display fallback',
            knownValues: ['protocols_io', 'bio_protocol', 'other'],
          },
        },
      },
      material: {
        type: 'object',
        description: 'A physical material, reagent, or plasmid',
        properties: {
          url: {
            type: 'string',
            format: 'uri',
            description: 'Material URL',
          },
          rrid: {
            type: 'string',
            description: 'Research Resource Identifier',
          },
          label: {
            type: 'string',
            description: 'User-provided label',
          },
        },
      },
      fundingSource: {
        type: 'object',
        description: 'A funding source',
        properties: {
          funderName: {
            type: 'string',
            description: 'Funder name',
            maxLength: 300,
          },
          funderUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI to funder institution node (subkind=institution)',
          },
          funderDoi: {
            type: 'string',
            description: 'CrossRef Funder Registry DOI',
          },
          funderRor: {
            type: 'string',
            description: 'ROR identifier',
          },
          grantNumber: {
            type: 'string',
            description: 'Grant number',
            maxLength: 100,
          },
          grantTitle: {
            type: 'string',
            description: 'Grant title',
            maxLength: 500,
          },
          grantUrl: {
            type: 'string',
            format: 'uri',
            description: 'Grant URL',
          },
        },
      },
      conferencePresentation: {
        type: 'object',
        description: 'Conference where this work was presented',
        properties: {
          conferenceName: {
            type: 'string',
            description: 'Conference name',
            maxLength: 500,
          },
          conferenceAcronym: {
            type: 'string',
            description: 'Conference acronym',
            maxLength: 50,
          },
          conferenceUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI to conference/event node (subkind=event)',
          },
          conferenceUrl: {
            type: 'string',
            format: 'uri',
            description: 'Conference website URL',
          },
          conferenceLocation: {
            type: 'string',
            description: 'Conference location',
          },
          presentationDate: {
            type: 'string',
            format: 'datetime',
            description: 'Presentation date',
          },
          presentationTypeUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI to presentation type node (subkind=presentation-type)',
          },
          presentationTypeSlug: {
            type: 'string',
            description: 'Presentation type slug for display fallback',
            knownValues: ['oral', 'poster', 'keynote', 'workshop', 'demo', 'other'],
          },
          proceedingsDoi: {
            type: 'string',
            description: 'Proceedings DOI',
          },
        },
      },
      textItem: {
        type: 'object',
        description: 'Plain text content item in rich abstract',
        required: ['type', 'content'],
        properties: {
          type: {
            type: 'string',
            const: 'text',
          },
          content: {
            type: 'string',
            maxLength: 10000,
          },
        },
      },
      nodeRefItem: {
        type: 'object',
        description: 'Reference to a knowledge graph node in rich abstract',
        required: ['type', 'uri'],
        properties: {
          type: {
            type: 'string',
            const: 'nodeRef',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the referenced node',
          },
          label: {
            type: 'string',
            maxLength: 500,
            description: 'Display label (cached from node)',
          },
          subkind: {
            type: 'string',
            maxLength: 50,
            description: 'Subkind slug for styling',
          },
        },
      },
    },
  },
  PubChiveEprintUserTag: {
    lexicon: 1,
    id: 'pub.chive.eprint.userTag',
    defs: {
      main: {
        type: 'record',
        description:
          'User-generated tag on eprint (TaxoFolk) with optional knowledge graph linking',
        key: 'tid',
        record: {
          type: 'object',
          required: ['eprintUri', 'tag', 'createdAt'],
          properties: {
            eprintUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of the tagged eprint',
            },
            tag: {
              type: 'string',
              description: 'Tag label (user-provided text)',
              maxLength: 100,
            },
            nodeUri: {
              type: 'string',
              format: 'at-uri',
              description:
                'Optional AT-URI to linked knowledge graph node (subkind=topic, concept, field, etc.)',
            },
            nodeSlug: {
              type: 'string',
              description: 'Node slug for display fallback when nodeUri is present',
              maxLength: 100,
            },
            nodeSubkind: {
              type: 'string',
              description:
                "Subkind of the linked node for styling (e.g., 'topic', 'concept', 'field')",
              maxLength: 50,
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  PubChiveEprintVersion: {
    lexicon: 1,
    id: 'pub.chive.eprint.version',
    defs: {
      main: {
        type: 'record',
        description: 'Eprint version metadata',
        key: 'tid',
        record: {
          type: 'object',
          required: ['eprintUri', 'versionNumber', 'changes', 'createdAt'],
          properties: {
            eprintUri: {
              type: 'string',
              format: 'at-uri',
              description: 'URI of eprint record',
            },
            versionNumber: {
              type: 'integer',
              minimum: 1,
            },
            previousVersionUri: {
              type: 'string',
              format: 'at-uri',
            },
            changes: {
              type: 'string',
              description: 'Changelog describing changes',
              maxLength: 2000,
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  PubChiveGovernanceApproveElevation: {
    lexicon: 1,
    id: 'pub.chive.governance.approveElevation',
    defs: {
      main: {
        type: 'procedure',
        description: 'Approve a pending elevation request. Only accessible by administrators.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['requestId'],
            properties: {
              requestId: {
                type: 'string',
                description: 'ID of the elevation request to approve',
              },
              verificationNotes: {
                type: 'string',
                description: 'Optional admin verification notes',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:pub.chive.governance.approveElevation#elevationResult',
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'Unauthorized',
          },
          {
            name: 'NotFound',
          },
        ],
      },
      elevationResult: {
        type: 'object',
        description: 'Result of elevation operation',
        required: ['success', 'message'],
        properties: {
          success: {
            type: 'boolean',
            description: 'Whether the operation succeeded',
          },
          requestId: {
            type: 'string',
            description: 'Elevation request ID',
          },
          message: {
            type: 'string',
            description: 'Human-readable result message',
          },
        },
      },
    },
  },
  PubChiveGovernanceGetEditorStatus: {
    lexicon: 1,
    id: 'pub.chive.governance.getEditorStatus',
    defs: {
      main: {
        type: 'query',
        description: 'Get the trusted editor status and reputation metrics for a user',
        parameters: {
          type: 'params',
          properties: {
            did: {
              type: 'string',
              format: 'did',
              description: 'User DID (defaults to authenticated user)',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:pub.chive.governance.getEditorStatus#editorStatus',
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'NotFound',
          },
        ],
      },
      editorStatus: {
        type: 'object',
        description: 'Editor status and metrics',
        required: ['did', 'role', 'hasDelegation', 'metrics'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
            description: 'User DID',
          },
          displayName: {
            type: 'string',
            description: 'User display name',
          },
          role: {
            type: 'string',
            knownValues: [
              'community-member',
              'trusted-editor',
              'graph-editor',
              'domain-expert',
              'administrator',
            ],
            description: 'Current governance role',
          },
          roleGrantedAt: {
            type: 'integer',
            description: 'Timestamp when role was granted',
          },
          roleGrantedBy: {
            type: 'string',
            format: 'did',
            description: 'DID of admin who granted the role',
          },
          hasDelegation: {
            type: 'boolean',
            description: 'Whether user has an active PDS delegation',
          },
          delegationExpiresAt: {
            type: 'integer',
            description: 'Delegation expiration timestamp',
          },
          delegationCollections: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Collections the delegation covers',
          },
          recordsCreatedToday: {
            type: 'integer',
            minimum: 0,
            description: 'Records created today under delegation',
          },
          dailyRateLimit: {
            type: 'integer',
            minimum: 0,
            description: 'Daily rate limit for delegation',
          },
          metrics: {
            type: 'ref',
            ref: 'lex:pub.chive.governance.getEditorStatus#reputationMetrics',
          },
        },
      },
      reputationMetrics: {
        type: 'object',
        description: 'User reputation metrics for governance',
        required: [
          'did',
          'accountCreatedAt',
          'accountAgeDays',
          'eprintCount',
          'wellEndorsedEprintCount',
          'totalEndorsements',
          'proposalCount',
          'voteCount',
          'successfulProposals',
          'warningCount',
          'violationCount',
          'reputationScore',
          'role',
          'eligibleForTrustedEditor',
          'missingCriteria',
        ],
        properties: {
          did: {
            type: 'string',
            format: 'did',
            description: 'User DID',
          },
          accountCreatedAt: {
            type: 'integer',
            description: 'Account creation timestamp',
          },
          accountAgeDays: {
            type: 'integer',
            minimum: 0,
            description: 'Account age in days',
          },
          eprintCount: {
            type: 'integer',
            minimum: 0,
            description: 'Total eprints authored',
          },
          wellEndorsedEprintCount: {
            type: 'integer',
            minimum: 0,
            description: 'Eprints with substantial endorsements',
          },
          totalEndorsements: {
            type: 'integer',
            minimum: 0,
            description: 'Total endorsements received',
          },
          proposalCount: {
            type: 'integer',
            minimum: 0,
            description: 'Governance proposals submitted',
          },
          voteCount: {
            type: 'integer',
            minimum: 0,
            description: 'Votes cast',
          },
          successfulProposals: {
            type: 'integer',
            minimum: 0,
            description: 'Proposals that were approved',
          },
          warningCount: {
            type: 'integer',
            minimum: 0,
            description: 'Moderation warnings received',
          },
          violationCount: {
            type: 'integer',
            minimum: 0,
            description: 'Policy violations recorded',
          },
          reputationScore: {
            type: 'integer',
            minimum: 0,
            description: 'Computed reputation score',
          },
          role: {
            type: 'string',
            knownValues: [
              'community-member',
              'trusted-editor',
              'graph-editor',
              'domain-expert',
              'administrator',
            ],
            description: 'Current governance role',
          },
          eligibleForTrustedEditor: {
            type: 'boolean',
            description: 'Whether user meets trusted editor criteria',
          },
          missingCriteria: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'List of missing eligibility criteria',
          },
        },
      },
    },
  },
  PubChiveGovernanceGetPendingCount: {
    lexicon: 1,
    id: 'pub.chive.governance.getPendingCount',
    defs: {
      main: {
        type: 'query',
        description: 'Get the count of pending governance proposals, used for notification badges',
        parameters: {
          type: 'params',
          properties: {
            kind: {
              type: 'string',
              knownValues: ['type', 'object'],
              description: 'Filter by node kind',
            },
            subkind: {
              type: 'string',
              description: 'Filter by subkind (field, institution, etc.)',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['count'],
            properties: {
              count: {
                type: 'integer',
                minimum: 0,
                description: 'Number of pending proposals',
              },
            },
          },
        },
        errors: [],
      },
    },
  },
  PubChiveGovernanceGetProposal: {
    lexicon: 1,
    id: 'pub.chive.governance.getProposal',
    defs: {
      main: {
        type: 'query',
        description: 'Get a single governance proposal by ID with full enrichment',
        parameters: {
          type: 'params',
          required: ['proposalId'],
          properties: {
            proposalId: {
              type: 'string',
              description: 'Proposal identifier',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:pub.chive.governance.getProposal#proposalView',
          },
        },
        errors: [
          {
            name: 'NotFound',
          },
        ],
      },
      proposalView: {
        type: 'object',
        description: 'View of a governance proposal',
        required: [
          'id',
          'uri',
          'cid',
          'type',
          'changes',
          'status',
          'proposedBy',
          'votes',
          'consensus',
          'createdAt',
        ],
        properties: {
          id: {
            type: 'string',
            description: 'Proposal identifier',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'Proposal AT-URI',
          },
          cid: {
            type: 'string',
            description: 'Content identifier',
          },
          nodeUri: {
            type: 'string',
            format: 'at-uri',
            description: 'Target node URI (for update/merge/deprecate)',
          },
          label: {
            type: 'string',
            description: 'Node label (from target node or proposed changes)',
          },
          type: {
            type: 'string',
            knownValues: ['create', 'update', 'merge', 'deprecate'],
            description: 'Proposal type',
          },
          changes: {
            type: 'ref',
            ref: 'lex:pub.chive.governance.getProposal#proposalChanges',
            description: 'Proposed changes',
          },
          rationale: {
            type: 'string',
            description: 'Rationale for the proposal',
          },
          status: {
            type: 'string',
            knownValues: ['pending', 'approved', 'rejected', 'expired'],
            description: 'Current proposal status',
          },
          proposedBy: {
            type: 'string',
            format: 'did',
            description: 'DID of the proposer',
          },
          proposerName: {
            type: 'string',
            description: 'Display name of the proposer',
          },
          votes: {
            type: 'ref',
            ref: 'lex:pub.chive.governance.getProposal#voteCounts',
          },
          consensus: {
            type: 'ref',
            ref: 'lex:pub.chive.governance.getProposal#consensusProgress',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'Creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'datetime',
            description: 'Last update timestamp',
          },
          expiresAt: {
            type: 'string',
            format: 'datetime',
            description: 'Expiration timestamp',
          },
        },
      },
      proposalChanges: {
        type: 'object',
        description: 'Proposed changes to a node',
        properties: {
          label: {
            type: 'string',
            description: 'Node label',
          },
          alternateLabels: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Alternate labels',
          },
          description: {
            type: 'string',
            description: 'Node description',
          },
          externalIds: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.governance.getProposal#externalId',
            },
            description: 'External identifiers',
          },
          metadata: {
            type: 'unknown',
            description: 'Additional metadata',
          },
          kind: {
            type: 'string',
            knownValues: ['type', 'object'],
            description: 'Node kind',
          },
          subkind: {
            type: 'string',
            description: 'Node subkind',
          },
          targetUri: {
            type: 'string',
            format: 'at-uri',
            description: 'Target URI for update/deprecate',
          },
          mergeIntoUri: {
            type: 'string',
            format: 'at-uri',
            description: 'Merge target URI',
          },
        },
      },
      externalId: {
        type: 'object',
        required: ['system', 'identifier'],
        properties: {
          system: {
            type: 'string',
            description: 'External system name',
          },
          identifier: {
            type: 'string',
            description: 'Identifier in external system',
          },
          uri: {
            type: 'string',
            format: 'uri',
            description: 'URI in external system',
          },
          matchType: {
            type: 'string',
            knownValues: ['exact', 'close', 'broader', 'narrower', 'related'],
            description: 'Match type',
          },
        },
      },
      voteCounts: {
        type: 'object',
        required: ['approve', 'reject', 'abstain'],
        properties: {
          approve: {
            type: 'integer',
            minimum: 0,
            description: 'Number of approve votes',
          },
          reject: {
            type: 'integer',
            minimum: 0,
            description: 'Number of reject votes',
          },
          abstain: {
            type: 'integer',
            minimum: 0,
            description: 'Number of abstain votes',
          },
        },
      },
      consensusProgress: {
        type: 'object',
        required: [
          'approvalPercentage',
          'threshold',
          'voterCount',
          'minimumVotes',
          'consensusReached',
          'recommendedStatus',
        ],
        properties: {
          approvalPercentage: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description: 'Current approval percentage (0-100)',
          },
          threshold: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description: 'Required threshold for approval (0-100)',
          },
          voterCount: {
            type: 'integer',
            minimum: 0,
            description: 'Number of voters',
          },
          minimumVotes: {
            type: 'integer',
            minimum: 0,
            description: 'Minimum votes required',
          },
          consensusReached: {
            type: 'boolean',
            description: 'Whether consensus has been reached',
          },
          recommendedStatus: {
            type: 'string',
            knownValues: ['approved', 'rejected', 'pending'],
            description: 'Recommended status based on votes',
          },
        },
      },
    },
  },
  PubChiveGovernanceGetUserVote: {
    lexicon: 1,
    id: 'pub.chive.governance.getUserVote',
    defs: {
      main: {
        type: 'query',
        description: "Get a user's vote on a specific proposal, if they have voted",
        parameters: {
          type: 'params',
          required: ['proposalId', 'userDid'],
          properties: {
            proposalId: {
              type: 'string',
              description: 'Proposal identifier',
            },
            userDid: {
              type: 'string',
              format: 'did',
              description: 'User DID',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['vote'],
            properties: {
              vote: {
                type: 'union',
                refs: ['lex:pub.chive.governance.getUserVote#voteView'],
                description: 'Vote if found, or null',
              },
            },
          },
        },
        errors: [
          {
            name: 'NotFound',
          },
        ],
      },
      voteView: {
        type: 'object',
        description: 'View of a vote on a proposal',
        required: [
          'id',
          'uri',
          'cid',
          'proposalUri',
          'voterDid',
          'voterRole',
          'vote',
          'weight',
          'createdAt',
        ],
        properties: {
          id: {
            type: 'string',
            description: 'Vote identifier',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'Vote AT-URI',
          },
          cid: {
            type: 'string',
            description: 'Content identifier',
          },
          proposalUri: {
            type: 'string',
            format: 'at-uri',
            description: 'Proposal AT-URI',
          },
          voterDid: {
            type: 'string',
            format: 'did',
            description: 'Voter DID',
          },
          voterRole: {
            type: 'string',
            knownValues: ['community-member', 'reviewer', 'domain-expert', 'administrator'],
            description: 'Voter governance role',
          },
          vote: {
            type: 'string',
            knownValues: ['approve', 'reject', 'abstain', 'request-changes'],
            description: 'Vote value',
          },
          weight: {
            type: 'integer',
            minimum: 0,
            maximum: 1000,
            description: 'Weighted vote value (scaled by 1000 for 0.0-1.0 range)',
          },
          rationale: {
            type: 'string',
            description: 'Vote rationale',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'Vote timestamp',
          },
        },
      },
    },
  },
  PubChiveGovernanceGrantDelegation: {
    lexicon: 1,
    id: 'pub.chive.governance.grantDelegation',
    defs: {
      main: {
        type: 'procedure',
        description:
          'Grant PDS delegation to a trusted editor. Only accessible to administrators. Delegation allows the user to write records to the Governance PDS.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['delegateDid', 'collections', 'daysValid'],
            properties: {
              delegateDid: {
                type: 'string',
                format: 'did',
                description: 'DID of the user to delegate to',
              },
              collections: {
                type: 'array',
                minLength: 1,
                items: {
                  type: 'string',
                },
                description: 'NSID collections the delegation covers',
              },
              daysValid: {
                type: 'integer',
                minimum: 1,
                maximum: 365,
                default: 365,
                description: 'Number of days the delegation is valid',
              },
              maxRecordsPerDay: {
                type: 'integer',
                minimum: 1,
                maximum: 1000,
                default: 100,
                description: 'Maximum records delegate can create per day',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:pub.chive.governance.grantDelegation#delegationResult',
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'Unauthorized',
          },
          {
            name: 'InvalidRequest',
          },
        ],
      },
      delegationResult: {
        type: 'object',
        description: 'Result of delegation operation',
        required: ['success', 'message'],
        properties: {
          success: {
            type: 'boolean',
            description: 'Whether the operation succeeded',
          },
          delegationId: {
            type: 'string',
            description: 'Delegation ID (if created)',
          },
          message: {
            type: 'string',
            description: 'Human-readable result message',
          },
        },
      },
    },
  },
  PubChiveGovernanceListDelegations: {
    lexicon: 1,
    id: 'pub.chive.governance.listDelegations',
    defs: {
      main: {
        type: 'query',
        description: 'List active PDS delegations. Only accessible by administrators.',
        parameters: {
          type: 'params',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: 'Maximum number of results to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor for next page',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['delegations', 'total'],
            properties: {
              delegations: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.governance.listDelegations#delegation',
                },
                description: 'List of delegations',
              },
              cursor: {
                type: 'string',
                description: 'Cursor for next page',
              },
              total: {
                type: 'integer',
                description: 'Total number of delegations',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'Unauthorized',
          },
        ],
      },
      delegation: {
        type: 'object',
        description: 'PDS delegation record',
        required: [
          'id',
          'delegateDid',
          'collections',
          'expiresAt',
          'maxRecordsPerDay',
          'recordsCreatedToday',
          'grantedAt',
          'grantedBy',
          'active',
        ],
        properties: {
          id: {
            type: 'string',
            description: 'Delegation identifier',
          },
          delegateDid: {
            type: 'string',
            format: 'did',
            description: 'DID of the delegate',
          },
          handle: {
            type: 'string',
            description: 'Delegate handle',
          },
          displayName: {
            type: 'string',
            description: 'Delegate display name',
          },
          collections: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'NSID collections the delegation covers',
          },
          expiresAt: {
            type: 'integer',
            description: 'Expiration timestamp',
          },
          maxRecordsPerDay: {
            type: 'integer',
            minimum: 0,
            description: 'Maximum records delegate can create per day',
          },
          recordsCreatedToday: {
            type: 'integer',
            minimum: 0,
            description: 'Records created today under this delegation',
          },
          grantedAt: {
            type: 'integer',
            description: 'Timestamp when delegation was granted',
          },
          grantedBy: {
            type: 'string',
            format: 'did',
            description: 'DID of admin who granted the delegation',
          },
          active: {
            type: 'boolean',
            description: 'Whether the delegation is currently active',
          },
        },
      },
    },
  },
  PubChiveGovernanceListElevationRequests: {
    lexicon: 1,
    id: 'pub.chive.governance.listElevationRequests',
    defs: {
      main: {
        type: 'query',
        description:
          'List pending elevation requests for admin review. Only accessible by administrators.',
        parameters: {
          type: 'params',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: 'Maximum number of results to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor for next page',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['requests', 'total'],
            properties: {
              requests: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.governance.listElevationRequests#elevationRequest',
                },
                description: 'List of elevation requests',
              },
              cursor: {
                type: 'string',
                description: 'Cursor for next page',
              },
              total: {
                type: 'integer',
                description: 'Total number of requests',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'Unauthorized',
          },
        ],
      },
      elevationRequest: {
        type: 'object',
        description: 'Elevation request record',
        required: ['id', 'did', 'requestedRole', 'currentRole', 'requestedAt', 'metrics'],
        properties: {
          id: {
            type: 'string',
            description: 'Request identifier',
          },
          did: {
            type: 'string',
            format: 'did',
            description: 'Requester DID',
          },
          handle: {
            type: 'string',
            description: 'Requester handle',
          },
          displayName: {
            type: 'string',
            description: 'Requester display name',
          },
          requestedRole: {
            type: 'string',
            knownValues: ['trusted-editor', 'administrator'],
            description: 'Role being requested',
          },
          currentRole: {
            type: 'string',
            knownValues: ['community-member', 'trusted-editor', 'administrator'],
            description: 'Current role',
          },
          requestedAt: {
            type: 'string',
            format: 'datetime',
            description: 'Request timestamp',
          },
          metrics: {
            type: 'ref',
            ref: 'lex:pub.chive.governance.listElevationRequests#reputationMetrics',
          },
          verificationNotes: {
            type: 'string',
            description: 'Admin verification notes',
          },
        },
      },
      reputationMetrics: {
        type: 'object',
        description: 'User reputation metrics for governance',
        required: [
          'did',
          'accountCreatedAt',
          'accountAgeDays',
          'eprintCount',
          'wellEndorsedEprintCount',
          'totalEndorsements',
          'proposalCount',
          'voteCount',
          'successfulProposals',
          'warningCount',
          'violationCount',
          'reputationScore',
          'role',
          'eligibleForTrustedEditor',
          'missingCriteria',
        ],
        properties: {
          did: {
            type: 'string',
            format: 'did',
            description: 'User DID',
          },
          accountCreatedAt: {
            type: 'integer',
            description: 'Account creation timestamp',
          },
          accountAgeDays: {
            type: 'integer',
            minimum: 0,
            description: 'Account age in days',
          },
          eprintCount: {
            type: 'integer',
            minimum: 0,
            description: 'Total eprints authored',
          },
          wellEndorsedEprintCount: {
            type: 'integer',
            minimum: 0,
            description: 'Eprints with substantial endorsements',
          },
          totalEndorsements: {
            type: 'integer',
            minimum: 0,
            description: 'Total endorsements received',
          },
          proposalCount: {
            type: 'integer',
            minimum: 0,
            description: 'Governance proposals submitted',
          },
          voteCount: {
            type: 'integer',
            minimum: 0,
            description: 'Votes cast',
          },
          successfulProposals: {
            type: 'integer',
            minimum: 0,
            description: 'Proposals that were approved',
          },
          warningCount: {
            type: 'integer',
            minimum: 0,
            description: 'Moderation warnings received',
          },
          violationCount: {
            type: 'integer',
            minimum: 0,
            description: 'Policy violations recorded',
          },
          reputationScore: {
            type: 'integer',
            minimum: 0,
            description: 'Computed reputation score',
          },
          role: {
            type: 'string',
            knownValues: [
              'community-member',
              'trusted-editor',
              'graph-editor',
              'domain-expert',
              'administrator',
            ],
            description: 'Current governance role',
          },
          eligibleForTrustedEditor: {
            type: 'boolean',
            description: 'Whether user meets trusted editor criteria',
          },
          missingCriteria: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'List of missing eligibility criteria',
          },
        },
      },
    },
  },
  PubChiveGovernanceListProposals: {
    lexicon: 1,
    id: 'pub.chive.governance.listProposals',
    defs: {
      main: {
        type: 'query',
        description:
          'List governance proposals with optional filtering by status, type, and other criteria',
        parameters: {
          type: 'params',
          properties: {
            status: {
              type: 'string',
              knownValues: ['pending', 'approved', 'rejected', 'expired'],
              description: 'Filter by proposal status',
            },
            type: {
              type: 'string',
              knownValues: ['create', 'update', 'merge', 'deprecate'],
              description: 'Filter by proposal type',
            },
            kind: {
              type: 'string',
              knownValues: ['type', 'object'],
              description: 'Filter by node kind',
            },
            subkind: {
              type: 'string',
              description: 'Filter by subkind (field, institution, etc.)',
            },
            nodeUri: {
              type: 'string',
              format: 'at-uri',
              description: 'Filter by target node URI',
            },
            proposedBy: {
              type: 'string',
              format: 'did',
              description: 'Filter by proposer DID',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Maximum number of results to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor for next page',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['proposals', 'total'],
            properties: {
              proposals: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.governance.listProposals#proposalView',
                },
                description: 'List of proposals',
              },
              cursor: {
                type: 'string',
                description: 'Cursor for next page',
              },
              total: {
                type: 'integer',
                description: 'Total number of proposals matching filters',
              },
            },
          },
        },
        errors: [],
      },
      proposalView: {
        type: 'object',
        description: 'View of a governance proposal',
        required: [
          'id',
          'uri',
          'cid',
          'type',
          'changes',
          'status',
          'proposedBy',
          'votes',
          'consensus',
          'createdAt',
        ],
        properties: {
          id: {
            type: 'string',
            description: 'Proposal identifier',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'Proposal AT-URI',
          },
          cid: {
            type: 'string',
            description: 'Content identifier',
          },
          nodeUri: {
            type: 'string',
            format: 'at-uri',
            description: 'Target node URI (for update/merge/deprecate)',
          },
          label: {
            type: 'string',
            description: 'Node label (from target node or proposed changes)',
          },
          type: {
            type: 'string',
            knownValues: ['create', 'update', 'merge', 'deprecate'],
            description: 'Proposal type',
          },
          changes: {
            type: 'ref',
            ref: 'lex:pub.chive.governance.listProposals#proposalChanges',
            description: 'Proposed changes',
          },
          rationale: {
            type: 'string',
            description: 'Rationale for the proposal',
          },
          status: {
            type: 'string',
            knownValues: ['pending', 'approved', 'rejected', 'expired'],
            description: 'Current proposal status',
          },
          proposedBy: {
            type: 'string',
            format: 'did',
            description: 'DID of the proposer',
          },
          proposerName: {
            type: 'string',
            description: 'Display name of the proposer',
          },
          votes: {
            type: 'ref',
            ref: 'lex:pub.chive.governance.listProposals#voteCounts',
          },
          consensus: {
            type: 'ref',
            ref: 'lex:pub.chive.governance.listProposals#consensusProgress',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'Creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'datetime',
            description: 'Last update timestamp',
          },
          expiresAt: {
            type: 'string',
            format: 'datetime',
            description: 'Expiration timestamp',
          },
        },
      },
      proposalChanges: {
        type: 'object',
        description: 'Proposed changes to a node',
        properties: {
          label: {
            type: 'string',
            description: 'Node label',
          },
          alternateLabels: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Alternate labels',
          },
          description: {
            type: 'string',
            description: 'Node description',
          },
          externalIds: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.governance.listProposals#externalId',
            },
            description: 'External identifiers',
          },
          metadata: {
            type: 'unknown',
            description: 'Additional metadata',
          },
          kind: {
            type: 'string',
            knownValues: ['type', 'object'],
            description: 'Node kind',
          },
          subkind: {
            type: 'string',
            description: 'Node subkind',
          },
          targetUri: {
            type: 'string',
            format: 'at-uri',
            description: 'Target URI for update/deprecate',
          },
          mergeIntoUri: {
            type: 'string',
            format: 'at-uri',
            description: 'Merge target URI',
          },
        },
      },
      externalId: {
        type: 'object',
        required: ['system', 'identifier'],
        properties: {
          system: {
            type: 'string',
            description: 'External system name',
          },
          identifier: {
            type: 'string',
            description: 'Identifier in external system',
          },
          uri: {
            type: 'string',
            format: 'uri',
            description: 'URI in external system',
          },
          matchType: {
            type: 'string',
            knownValues: ['exact', 'close', 'broader', 'narrower', 'related'],
            description: 'Match type',
          },
        },
      },
      voteCounts: {
        type: 'object',
        required: ['approve', 'reject', 'abstain'],
        properties: {
          approve: {
            type: 'integer',
            minimum: 0,
            description: 'Number of approve votes',
          },
          reject: {
            type: 'integer',
            minimum: 0,
            description: 'Number of reject votes',
          },
          abstain: {
            type: 'integer',
            minimum: 0,
            description: 'Number of abstain votes',
          },
        },
      },
      consensusProgress: {
        type: 'object',
        required: [
          'approvalPercentage',
          'threshold',
          'voterCount',
          'minimumVotes',
          'consensusReached',
          'recommendedStatus',
        ],
        properties: {
          approvalPercentage: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description: 'Current approval percentage (0-100)',
          },
          threshold: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description: 'Required threshold for approval (0-100)',
          },
          voterCount: {
            type: 'integer',
            minimum: 0,
            description: 'Number of voters',
          },
          minimumVotes: {
            type: 'integer',
            minimum: 0,
            description: 'Minimum votes required',
          },
          consensusReached: {
            type: 'boolean',
            description: 'Whether consensus has been reached',
          },
          recommendedStatus: {
            type: 'string',
            knownValues: ['approved', 'rejected', 'pending'],
            description: 'Recommended status based on votes',
          },
        },
      },
    },
  },
  PubChiveGovernanceListTrustedEditors: {
    lexicon: 1,
    id: 'pub.chive.governance.listTrustedEditors',
    defs: {
      main: {
        type: 'query',
        description: 'List all users with trusted editor or higher roles (admin only)',
        parameters: {
          type: 'params',
          properties: {
            role: {
              type: 'string',
              knownValues: [
                'community-member',
                'trusted-editor',
                'graph-editor',
                'domain-expert',
                'administrator',
              ],
              description: 'Filter by role',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Maximum number of results to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor for next page',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['editors', 'total'],
            properties: {
              editors: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.governance.listTrustedEditors#trustedEditor',
                },
                description: 'List of trusted editors',
              },
              cursor: {
                type: 'string',
                description: 'Cursor for next page',
              },
              total: {
                type: 'integer',
                description: 'Total number of editors',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'Unauthorized',
          },
        ],
      },
      trustedEditor: {
        type: 'object',
        description: 'Trusted editor record',
        required: ['did', 'role', 'roleGrantedAt', 'hasDelegation', 'metrics'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
            description: 'Editor DID',
          },
          handle: {
            type: 'string',
            description: 'Editor handle',
          },
          displayName: {
            type: 'string',
            description: 'Editor display name',
          },
          role: {
            type: 'string',
            knownValues: [
              'community-member',
              'trusted-editor',
              'graph-editor',
              'domain-expert',
              'administrator',
            ],
            description: 'Current governance role',
          },
          roleGrantedAt: {
            type: 'integer',
            description: 'Timestamp when role was granted',
          },
          roleGrantedBy: {
            type: 'string',
            format: 'did',
            description: 'DID of admin who granted the role',
          },
          hasDelegation: {
            type: 'boolean',
            description: 'Whether editor has an active PDS delegation',
          },
          delegationExpiresAt: {
            type: 'integer',
            description: 'Delegation expiration timestamp',
          },
          recordsCreatedToday: {
            type: 'integer',
            minimum: 0,
            description: 'Records created today under delegation',
          },
          dailyRateLimit: {
            type: 'integer',
            minimum: 0,
            description: 'Daily rate limit for delegation',
          },
          metrics: {
            type: 'ref',
            ref: 'lex:pub.chive.governance.listTrustedEditors#reputationMetrics',
          },
        },
      },
      reputationMetrics: {
        type: 'object',
        description: 'User reputation metrics for governance',
        required: [
          'did',
          'accountCreatedAt',
          'accountAgeDays',
          'eprintCount',
          'wellEndorsedEprintCount',
          'totalEndorsements',
          'proposalCount',
          'voteCount',
          'successfulProposals',
          'warningCount',
          'violationCount',
          'reputationScore',
          'role',
          'eligibleForTrustedEditor',
          'missingCriteria',
        ],
        properties: {
          did: {
            type: 'string',
            format: 'did',
            description: 'User DID',
          },
          accountCreatedAt: {
            type: 'integer',
            description: 'Account creation timestamp',
          },
          accountAgeDays: {
            type: 'integer',
            minimum: 0,
            description: 'Account age in days',
          },
          eprintCount: {
            type: 'integer',
            minimum: 0,
            description: 'Total eprints authored',
          },
          wellEndorsedEprintCount: {
            type: 'integer',
            minimum: 0,
            description: 'Eprints with substantial endorsements',
          },
          totalEndorsements: {
            type: 'integer',
            minimum: 0,
            description: 'Total endorsements received',
          },
          proposalCount: {
            type: 'integer',
            minimum: 0,
            description: 'Governance proposals submitted',
          },
          voteCount: {
            type: 'integer',
            minimum: 0,
            description: 'Votes cast',
          },
          successfulProposals: {
            type: 'integer',
            minimum: 0,
            description: 'Proposals that were approved',
          },
          warningCount: {
            type: 'integer',
            minimum: 0,
            description: 'Moderation warnings received',
          },
          violationCount: {
            type: 'integer',
            minimum: 0,
            description: 'Policy violations recorded',
          },
          reputationScore: {
            type: 'integer',
            minimum: 0,
            description: 'Computed reputation score',
          },
          role: {
            type: 'string',
            knownValues: [
              'community-member',
              'trusted-editor',
              'graph-editor',
              'domain-expert',
              'administrator',
            ],
            description: 'Current governance role',
          },
          eligibleForTrustedEditor: {
            type: 'boolean',
            description: 'Whether user meets trusted editor criteria',
          },
          missingCriteria: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'List of missing eligibility criteria',
          },
        },
      },
    },
  },
  PubChiveGovernanceListVotes: {
    lexicon: 1,
    id: 'pub.chive.governance.listVotes',
    defs: {
      main: {
        type: 'query',
        description: 'List votes for a specific governance proposal',
        parameters: {
          type: 'params',
          required: ['proposalId'],
          properties: {
            proposalId: {
              type: 'string',
              description: 'Proposal identifier',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 100,
              description: 'Maximum number of results to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor for next page',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['votes', 'total'],
            properties: {
              votes: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.governance.listVotes#voteView',
                },
                description: 'List of votes',
              },
              cursor: {
                type: 'string',
                description: 'Cursor for next page',
              },
              total: {
                type: 'integer',
                description: 'Total number of votes',
              },
            },
          },
        },
        errors: [],
      },
      voteView: {
        type: 'object',
        description: 'View of a vote on a proposal',
        required: [
          'id',
          'uri',
          'cid',
          'proposalUri',
          'voterDid',
          'voterRole',
          'vote',
          'weight',
          'createdAt',
        ],
        properties: {
          id: {
            type: 'string',
            description: 'Vote identifier',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'Vote AT-URI',
          },
          cid: {
            type: 'string',
            description: 'Content identifier',
          },
          proposalUri: {
            type: 'string',
            format: 'at-uri',
            description: 'Proposal AT-URI',
          },
          voterDid: {
            type: 'string',
            format: 'did',
            description: 'Voter DID',
          },
          voterName: {
            type: 'string',
            description: 'Voter display name',
          },
          voterRole: {
            type: 'string',
            knownValues: ['community-member', 'reviewer', 'domain-expert', 'administrator'],
            description: 'Voter governance role',
          },
          vote: {
            type: 'string',
            knownValues: ['approve', 'reject', 'abstain', 'request-changes'],
            description: 'Vote value',
          },
          weight: {
            type: 'integer',
            minimum: 0,
            maximum: 1000,
            description: 'Weighted vote value (scaled by 1000 for 0.0-1.0 range)',
          },
          rationale: {
            type: 'string',
            description: 'Vote rationale',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'Vote timestamp',
          },
        },
      },
    },
  },
  PubChiveGovernanceRejectElevation: {
    lexicon: 1,
    id: 'pub.chive.governance.rejectElevation',
    defs: {
      main: {
        type: 'procedure',
        description: 'Reject a pending elevation request. Only accessible by administrators.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['requestId', 'reason'],
            properties: {
              requestId: {
                type: 'string',
                description: 'ID of the elevation request to reject',
              },
              reason: {
                type: 'string',
                minLength: 10,
                maxLength: 1000,
                description: 'Reason for rejection',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:pub.chive.governance.rejectElevation#elevationResult',
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'Unauthorized',
          },
          {
            name: 'NotFound',
          },
        ],
      },
      elevationResult: {
        type: 'object',
        description: 'Result of elevation operation',
        required: ['success', 'message'],
        properties: {
          success: {
            type: 'boolean',
            description: 'Whether the operation succeeded',
          },
          requestId: {
            type: 'string',
            description: 'Elevation request ID',
          },
          message: {
            type: 'string',
            description: 'Human-readable result message',
          },
        },
      },
    },
  },
  PubChiveGovernanceRequestElevation: {
    lexicon: 1,
    id: 'pub.chive.governance.requestElevation',
    defs: {
      main: {
        type: 'procedure',
        description:
          'Request elevation to trusted editor role. The request is validated against eligibility criteria.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['targetRole'],
            properties: {
              targetRole: {
                type: 'string',
                knownValues: ['trusted-editor'],
                description: 'Role to request elevation to',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:pub.chive.governance.requestElevation#elevationResult',
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'InvalidRequest',
          },
        ],
      },
      elevationResult: {
        type: 'object',
        description: 'Result of elevation operation',
        required: ['success', 'message'],
        properties: {
          success: {
            type: 'boolean',
            description: 'Whether the operation succeeded',
          },
          requestId: {
            type: 'string',
            description: 'Elevation request ID (if created)',
          },
          message: {
            type: 'string',
            description: 'Human-readable result message',
          },
        },
      },
    },
  },
  PubChiveGovernanceRevokeDelegation: {
    lexicon: 1,
    id: 'pub.chive.governance.revokeDelegation',
    defs: {
      main: {
        type: 'procedure',
        description: 'Revoke an active PDS delegation. Only accessible to administrators.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['delegationId'],
            properties: {
              delegationId: {
                type: 'string',
                description: 'ID of the delegation to revoke',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:pub.chive.governance.revokeDelegation#delegationResult',
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'Unauthorized',
          },
          {
            name: 'NotFound',
          },
        ],
      },
      delegationResult: {
        type: 'object',
        description: 'Result of delegation operation',
        required: ['success', 'message'],
        properties: {
          success: {
            type: 'boolean',
            description: 'Whether the operation succeeded',
          },
          delegationId: {
            type: 'string',
            description: 'Delegation ID',
          },
          message: {
            type: 'string',
            description: 'Human-readable result message',
          },
        },
      },
    },
  },
  PubChiveGovernanceRevokeRole: {
    lexicon: 1,
    id: 'pub.chive.governance.revokeRole',
    defs: {
      main: {
        type: 'procedure',
        description:
          "Revoke a user's governance role. Only accessible to administrators. Also revokes any active delegation.",
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['did', 'reason'],
            properties: {
              did: {
                type: 'string',
                format: 'did',
                description: 'DID of the user whose role to revoke',
              },
              reason: {
                type: 'string',
                minLength: 10,
                maxLength: 1000,
                description: 'Reason for revoking the role',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:pub.chive.governance.revokeRole#elevationResult',
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'Unauthorized',
          },
          {
            name: 'InvalidRequest',
          },
        ],
      },
      elevationResult: {
        type: 'object',
        description: 'Result of role operation',
        required: ['success', 'message'],
        properties: {
          success: {
            type: 'boolean',
            description: 'Whether the operation succeeded',
          },
          requestId: {
            type: 'string',
            description: 'Request ID (if applicable)',
          },
          message: {
            type: 'string',
            description: 'Human-readable result message',
          },
        },
      },
    },
  },
  PubChiveGraphBrowseFaceted: {
    lexicon: 1,
    id: 'pub.chive.graph.browseFaceted',
    defs: {
      main: {
        type: 'query',
        description: 'Browse eprints using dynamic faceted classification from the knowledge graph',
        parameters: {
          type: 'params',
          properties: {
            q: {
              type: 'string',
              description: 'Optional text query',
            },
            facets: {
              type: 'string',
              description:
                'JSON-encoded facet filters keyed by facet slug (e.g., {"methodology":["meta-analysis"]})',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: 'Maximum results to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['hits', 'facets', 'hasMore', 'total'],
            properties: {
              hits: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.graph.browseFaceted#eprintSummary',
                },
                description: 'Matching eprints',
              },
              facets: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.graph.browseFaceted#facetDefinition',
                },
                description: 'Available facet refinements',
              },
              cursor: {
                type: 'string',
                description: 'Pagination cursor for next page',
              },
              hasMore: {
                type: 'boolean',
                description: 'Whether more results exist',
              },
              total: {
                type: 'integer',
                description: 'Total count of matching eprints',
              },
              impressionId: {
                type: 'string',
                description: 'Impression ID for click tracking',
              },
            },
          },
        },
      },
      eprintSummary: {
        type: 'object',
        description: 'Eprint summary for faceted browse results',
        required: [
          'uri',
          'cid',
          'title',
          'abstract',
          'authors',
          'submittedBy',
          'license',
          'createdAt',
          'indexedAt',
          'source',
        ],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'Eprint AT-URI',
          },
          cid: {
            type: 'string',
            description: 'CID of indexed version',
          },
          title: {
            type: 'string',
            description: 'Eprint title',
          },
          abstract: {
            type: 'string',
            description: 'Eprint abstract',
          },
          authors: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.graph.browseFaceted#authorRef',
            },
            description: 'All authors with contributions',
          },
          submittedBy: {
            type: 'string',
            format: 'did',
            description: 'DID of human user who submitted',
          },
          paperDid: {
            type: 'string',
            format: 'did',
            description: 'Paper DID if paper has its own PDS',
          },
          fields: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.graph.browseFaceted#fieldRef',
            },
            description: 'Subject fields',
          },
          license: {
            type: 'string',
            description: 'License identifier',
          },
          keywords: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Keywords',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'Creation timestamp',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
            description: 'Index timestamp',
          },
          source: {
            type: 'ref',
            ref: 'lex:pub.chive.graph.browseFaceted#sourceInfo',
            description: 'Source PDS information',
          },
          score: {
            type: 'integer',
            minimum: 0,
            maximum: 1000,
            description: 'Relevance score (scaled by 1000 for 0.0-1.0 range)',
          },
          highlights: {
            type: 'unknown',
            description: 'Search highlights keyed by field',
          },
        },
      },
      authorRef: {
        type: 'object',
        description: 'Author reference with contributions',
        required: ['did', 'name', 'order', 'affiliations', 'contributions'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
            description: 'Author DID',
          },
          name: {
            type: 'string',
            description: 'Display name',
          },
          orcid: {
            type: 'string',
            description: 'ORCID identifier',
          },
          email: {
            type: 'string',
            description: 'Contact email',
          },
          order: {
            type: 'integer',
            description: 'Author order (1-based)',
          },
          affiliations: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.graph.browseFaceted#affiliationRef',
            },
            description: 'Author affiliations',
          },
          contributions: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.graph.browseFaceted#contributionRef',
            },
            description: 'CRediT contributions',
          },
          isCorrespondingAuthor: {
            type: 'boolean',
            description: 'Whether this is the corresponding author',
          },
          isHighlighted: {
            type: 'boolean',
            description: 'Whether this author should be highlighted',
          },
          handle: {
            type: 'string',
            description: 'ATProto handle',
          },
          avatarUrl: {
            type: 'string',
            description: 'Avatar image URL',
          },
        },
      },
      affiliationRef: {
        type: 'object',
        description: 'Author affiliation',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Institution name',
          },
          rorId: {
            type: 'string',
            description: 'ROR identifier',
          },
          department: {
            type: 'string',
            description: 'Department name',
          },
        },
      },
      contributionRef: {
        type: 'object',
        description: 'CRediT contribution',
        required: ['typeUri', 'typeId', 'typeLabel'],
        properties: {
          typeUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of contribution type node',
          },
          typeId: {
            type: 'string',
            description: 'Contribution type identifier',
          },
          typeLabel: {
            type: 'string',
            description: 'Contribution type label',
          },
          degree: {
            type: 'string',
            knownValues: ['lead', 'equal', 'supporting'],
            description: 'Degree of contribution',
          },
        },
      },
      fieldRef: {
        type: 'object',
        description: 'Subject field reference',
        required: ['uri', 'label'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'Field AT-URI',
          },
          label: {
            type: 'string',
            description: 'Field label',
          },
          id: {
            type: 'string',
            description: 'Field identifier',
          },
          parentUri: {
            type: 'string',
            format: 'at-uri',
            description: 'Parent field AT-URI',
          },
        },
      },
      sourceInfo: {
        type: 'object',
        description: 'Source PDS information',
        required: ['pdsEndpoint'],
        properties: {
          pdsEndpoint: {
            type: 'string',
            description: 'PDS endpoint URL',
          },
          recordUrl: {
            type: 'string',
            description: 'Direct record URL',
          },
          blobUrl: {
            type: 'string',
            description: 'Blob URL',
          },
          lastVerifiedAt: {
            type: 'string',
            format: 'datetime',
            description: 'Last verification timestamp',
          },
          stale: {
            type: 'boolean',
            description: 'Whether data is potentially stale',
          },
        },
      },
      facetDefinition: {
        type: 'object',
        description: 'Facet definition from the knowledge graph',
        required: ['slug', 'label', 'values'],
        properties: {
          slug: {
            type: 'string',
            description: 'Facet slug identifier',
          },
          label: {
            type: 'string',
            description: 'Display label',
          },
          description: {
            type: 'string',
            description: 'Facet description',
          },
          values: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.graph.browseFaceted#facetValue',
            },
            description: 'Available values with counts',
          },
        },
      },
      facetValue: {
        type: 'object',
        description: 'Facet value with count',
        required: ['value', 'count'],
        properties: {
          value: {
            type: 'string',
            description: 'Facet value',
          },
          label: {
            type: 'string',
            description: 'Display label',
          },
          count: {
            type: 'integer',
            description: 'Number of eprints with this value',
          },
        },
      },
    },
  },
  PubChiveGraphEdge: {
    lexicon: 1,
    id: 'pub.chive.graph.edge',
    defs: {
      main: {
        type: 'record',
        description:
          'Typed relationship between knowledge graph nodes. Relation types are themselves nodes with subkind=relation.',
        key: 'any',
        record: {
          type: 'object',
          required: ['id', 'sourceUri', 'targetUri', 'relationSlug', 'status', 'createdAt'],
          properties: {
            id: {
              type: 'string',
              description: 'UUID identifier (also used as rkey)',
            },
            sourceUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of source node',
            },
            targetUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of target node',
            },
            relationUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of relation type node (subkind=relation)',
            },
            relationSlug: {
              type: 'string',
              maxLength: 50,
              description: 'Relation slug for queries (broader, narrower, related, etc.)',
            },
            weight: {
              type: 'integer',
              minimum: 0,
              maximum: 1000,
              description: 'Optional edge weight for ranking (scaled by 1000 for 0.0-1.0 range)',
            },
            metadata: {
              type: 'ref',
              ref: 'lex:pub.chive.graph.edge#edgeMetadata',
              description: 'Edge-specific metadata',
            },
            status: {
              type: 'string',
              knownValues: ['proposed', 'established', 'deprecated'],
              description: 'Edge lifecycle status',
            },
            proposalUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of the proposal that created this edge (null for seeded)',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
            createdBy: {
              type: 'string',
              format: 'did',
              description: 'DID of creator or governance',
            },
            updatedAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
      edgeMetadata: {
        type: 'object',
        description: 'Edge-specific metadata',
        properties: {
          confidence: {
            type: 'integer',
            minimum: 0,
            maximum: 1000,
            description:
              'Confidence score for automatically inferred edges (scaled by 1000 for 0.0-1.0 range)',
          },
          startDate: {
            type: 'string',
            format: 'datetime',
            description: 'Temporal start (for time-bounded relationships)',
          },
          endDate: {
            type: 'string',
            format: 'datetime',
            description: 'Temporal end (for time-bounded relationships)',
          },
          source: {
            type: 'string',
            maxLength: 200,
            description: 'Source of the relationship assertion',
          },
        },
      },
    },
  },
  PubChiveGraphEdgeProposal: {
    lexicon: 1,
    id: 'pub.chive.graph.edgeProposal',
    defs: {
      main: {
        type: 'record',
        description:
          'Proposal for creating, updating, or deprecating edges between knowledge graph nodes (stored in user PDS)',
        key: 'tid',
        record: {
          type: 'object',
          required: ['proposalType', 'rationale', 'createdAt'],
          properties: {
            proposalType: {
              type: 'string',
              knownValues: ['create', 'update', 'deprecate'],
              description: 'Type of proposal action',
            },
            targetEdgeUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of edge to update/deprecate',
            },
            proposedEdge: {
              type: 'ref',
              ref: 'lex:pub.chive.graph.edgeProposal#proposedEdgeData',
              description: 'Proposed edge data (for create/update)',
            },
            rationale: {
              type: 'string',
              maxLength: 2000,
              description: 'Justification for the proposal',
            },
            evidence: {
              type: 'array',
              items: {
                type: 'ref',
                ref: 'lex:pub.chive.graph.nodeProposal#evidence',
              },
              maxLength: 10,
              description: 'Supporting evidence for the proposal',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
      proposedEdgeData: {
        type: 'object',
        description: 'Proposed edge data',
        required: ['sourceUri', 'targetUri', 'relationSlug'],
        properties: {
          sourceUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of source node',
          },
          targetUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of target node',
          },
          relationUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of relation type node',
          },
          relationSlug: {
            type: 'string',
            maxLength: 50,
            description: 'Relation slug (broader, narrower, related, etc.)',
          },
          weight: {
            type: 'integer',
            minimum: 0,
            maximum: 1000,
            description: 'Edge weight (scaled by 1000 for 0.0-1.0 range)',
          },
          metadata: {
            type: 'ref',
            ref: 'lex:pub.chive.graph.edge#edgeMetadata',
          },
        },
      },
    },
  },
  PubChiveGraphGetCommunities: {
    lexicon: 1,
    id: 'pub.chive.graph.getCommunities',
    defs: {
      main: {
        type: 'query',
        description: 'Detect communities in the knowledge graph using graph clustering algorithms',
        parameters: {
          type: 'params',
          properties: {
            algorithm: {
              type: 'string',
              knownValues: ['louvain', 'label-propagation'],
              default: 'louvain',
              description: 'Community detection algorithm',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: 'Maximum communities to return',
            },
            minSize: {
              type: 'integer',
              minimum: 1,
              default: 2,
              description: 'Minimum community size',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['communities', 'algorithm', 'total', 'generatedAt'],
            properties: {
              communities: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.graph.getCommunities#communityResult',
                },
                description: 'Detected communities',
              },
              algorithm: {
                type: 'string',
                knownValues: ['louvain', 'label-propagation'],
                description: 'Algorithm used',
              },
              total: {
                type: 'integer',
                description: 'Total communities found',
              },
              generatedAt: {
                type: 'string',
                format: 'datetime',
                description: 'Timestamp when generated',
              },
            },
          },
        },
      },
      communityResult: {
        type: 'object',
        description: 'Community detection result',
        required: ['communityId', 'members', 'size'],
        properties: {
          communityId: {
            type: 'integer',
            description: 'Community identifier',
          },
          members: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Member URIs',
          },
          size: {
            type: 'integer',
            description: 'Number of members',
          },
          representativeMembers: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.graph.getCommunities#representativeMember',
            },
            description: 'Representative members with labels',
          },
        },
      },
      representativeMember: {
        type: 'object',
        description: 'Representative community member',
        required: ['uri', 'label'],
        properties: {
          uri: {
            type: 'string',
            description: 'Member AT-URI',
          },
          label: {
            type: 'string',
            description: 'Member label',
          },
        },
      },
    },
  },
  PubChiveGraphGetEdge: {
    lexicon: 1,
    id: 'pub.chive.graph.getEdge',
    defs: {
      main: {
        type: 'query',
        description: 'Retrieve a knowledge graph edge by AT-URI',
        parameters: {
          type: 'params',
          required: ['uri'],
          properties: {
            uri: {
              type: 'string',
              format: 'at-uri',
              description: 'Edge AT-URI',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:pub.chive.graph.getEdge#graphEdge',
          },
        },
        errors: [
          {
            name: 'NotFound',
          },
        ],
      },
      graphEdge: {
        type: 'object',
        description: 'Graph edge response',
        required: ['id', 'uri', 'sourceUri', 'targetUri', 'relationSlug', 'status', 'createdAt'],
        properties: {
          id: {
            type: 'string',
            description: 'Edge UUID identifier',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the edge',
          },
          cid: {
            type: 'string',
            description: 'Content identifier',
          },
          sourceUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of source node',
          },
          targetUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of target node',
          },
          relationUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of relation type node',
          },
          relationSlug: {
            type: 'string',
            description: 'Relation slug (broader, narrower, related, etc.)',
          },
          weight: {
            type: 'integer',
            minimum: 0,
            maximum: 1000,
            description: 'Edge weight (scaled by 1000 for 0.0-1.0 range)',
          },
          metadata: {
            type: 'ref',
            ref: 'lex:pub.chive.graph.edge#edgeMetadata',
            description: 'Edge-specific metadata',
          },
          status: {
            type: 'string',
            knownValues: ['proposed', 'established', 'deprecated'],
            description: 'Edge lifecycle status',
          },
          proposalUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of creating proposal',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'Creation timestamp',
          },
          createdBy: {
            type: 'string',
            format: 'did',
            description: 'DID of creator',
          },
          updatedAt: {
            type: 'string',
            format: 'datetime',
            description: 'Last update timestamp',
          },
        },
      },
    },
  },
  PubChiveGraphGetHierarchy: {
    lexicon: 1,
    id: 'pub.chive.graph.getHierarchy',
    defs: {
      main: {
        type: 'query',
        description: 'Get hierarchical tree structure for nodes of a specific subkind',
        parameters: {
          type: 'params',
          required: ['subkind'],
          properties: {
            subkind: {
              type: 'string',
              description: 'Subkind to get hierarchy for (e.g., field)',
            },
            relationSlug: {
              type: 'string',
              default: 'broader',
              description: 'Relation slug for hierarchy traversal',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['roots', 'subkind', 'relationSlug'],
            properties: {
              roots: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.graph.getHierarchy#hierarchyItem',
                },
                description: 'Root nodes with children',
              },
              subkind: {
                type: 'string',
                description: 'Subkind of hierarchy',
              },
              relationSlug: {
                type: 'string',
                description: 'Relation used for hierarchy',
              },
            },
          },
        },
      },
      hierarchyItem: {
        type: 'object',
        description: 'Hierarchy node with recursive children',
        required: ['node', 'children', 'depth'],
        properties: {
          node: {
            type: 'ref',
            ref: 'lex:pub.chive.graph.listNodes#graphNode',
            description: 'Node data',
          },
          children: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.graph.getHierarchy#hierarchyItem',
            },
            description: 'Child hierarchy items',
          },
          depth: {
            type: 'integer',
            description: 'Depth in hierarchy (0 = root)',
          },
        },
      },
    },
  },
  PubChiveGraphGetNode: {
    lexicon: 1,
    id: 'pub.chive.graph.getNode',
    defs: {
      main: {
        type: 'query',
        description: 'Retrieve a unified knowledge graph node by ID',
        parameters: {
          type: 'params',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Node ID (UUID or rkey)',
            },
            includeEdges: {
              type: 'boolean',
              default: false,
              description: 'Include connected edges in the response',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:pub.chive.graph.getNode#nodeWithEdges',
          },
        },
        errors: [
          {
            name: 'NotFound',
          },
        ],
      },
      nodeWithEdges: {
        type: 'object',
        description: 'Graph node with optional connected edges',
        required: ['id', 'uri', 'kind', 'label', 'status', 'createdAt'],
        properties: {
          id: {
            type: 'string',
            description: 'Node UUID identifier',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the node',
          },
          cid: {
            type: 'string',
            description: 'Content identifier',
          },
          kind: {
            type: 'string',
            knownValues: ['type', 'object'],
            description: 'Node kind: type or object',
          },
          subkind: {
            type: 'string',
            description: 'Subkind slug (e.g., field, institution)',
          },
          subkindUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the subkind type node',
          },
          label: {
            type: 'string',
            description: 'Primary display label',
          },
          alternateLabels: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Alternate labels/synonyms',
          },
          description: {
            type: 'string',
            description: 'Detailed description',
          },
          externalIds: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.graph.node#externalId',
            },
            description: 'External identifier mappings',
          },
          metadata: {
            type: 'ref',
            ref: 'lex:pub.chive.graph.node#nodeMetadata',
            description: 'Subkind-specific metadata',
          },
          status: {
            type: 'string',
            knownValues: ['proposed', 'provisional', 'established', 'deprecated'],
            description: 'Lifecycle status',
          },
          deprecatedBy: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of superseding node',
          },
          proposalUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of creating proposal',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'Creation timestamp',
          },
          createdBy: {
            type: 'string',
            format: 'did',
            description: 'DID of creator',
          },
          updatedAt: {
            type: 'string',
            format: 'datetime',
            description: 'Last update timestamp',
          },
          edges: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.graph.getNode#graphEdge',
            },
            description: 'Connected edges (when includeEdges=true)',
          },
        },
      },
      graphEdge: {
        type: 'object',
        description: 'Graph edge response',
        required: ['id', 'uri', 'sourceUri', 'targetUri', 'relationSlug', 'status', 'createdAt'],
        properties: {
          id: {
            type: 'string',
            description: 'Edge UUID identifier',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the edge',
          },
          cid: {
            type: 'string',
            description: 'Content identifier',
          },
          sourceUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of source node',
          },
          targetUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of target node',
          },
          relationUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of relation type node',
          },
          relationSlug: {
            type: 'string',
            description: 'Relation slug (broader, narrower, related, etc.)',
          },
          weight: {
            type: 'integer',
            minimum: 0,
            maximum: 1000,
            description: 'Edge weight (scaled by 1000 for 0.0-1.0 range)',
          },
          metadata: {
            type: 'ref',
            ref: 'lex:pub.chive.graph.edge#edgeMetadata',
            description: 'Edge-specific metadata',
          },
          status: {
            type: 'string',
            knownValues: ['proposed', 'established', 'deprecated'],
            description: 'Edge lifecycle status',
          },
          proposalUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of creating proposal',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'Creation timestamp',
          },
          createdBy: {
            type: 'string',
            format: 'did',
            description: 'DID of creator',
          },
          updatedAt: {
            type: 'string',
            format: 'datetime',
            description: 'Last update timestamp',
          },
        },
      },
    },
  },
  PubChiveGraphGetRelations: {
    lexicon: 1,
    id: 'pub.chive.graph.getRelations',
    defs: {
      main: {
        type: 'query',
        description: 'List available relation types (nodes with subkind=relation)',
        parameters: {
          type: 'params',
          properties: {},
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['relations'],
            properties: {
              relations: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.graph.getRelations#relationType',
                },
                description: 'Available relation types',
              },
            },
          },
        },
      },
      relationType: {
        type: 'object',
        description: 'Relation type definition',
        required: ['slug', 'label'],
        properties: {
          slug: {
            type: 'string',
            description: 'Relation slug identifier',
          },
          label: {
            type: 'string',
            description: 'Display label',
          },
          description: {
            type: 'string',
            description: 'Relation description',
          },
          inverseSlug: {
            type: 'string',
            description: 'Slug of inverse relation',
          },
        },
      },
    },
  },
  PubChiveGraphGetSubkinds: {
    lexicon: 1,
    id: 'pub.chive.graph.getSubkinds',
    defs: {
      main: {
        type: 'query',
        description: 'List available subkind type nodes (nodes with subkind=subkind)',
        parameters: {
          type: 'params',
          properties: {},
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['subkinds'],
            properties: {
              subkinds: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.graph.listNodes#graphNode',
                },
                description: 'Available subkind type nodes',
              },
            },
          },
        },
      },
    },
  },
  PubChiveGraphListEdges: {
    lexicon: 1,
    id: 'pub.chive.graph.listEdges',
    defs: {
      main: {
        type: 'query',
        description: 'List knowledge graph edges with optional filtering',
        parameters: {
          type: 'params',
          properties: {
            sourceUri: {
              type: 'string',
              format: 'at-uri',
              description: 'Filter by source node AT-URI',
            },
            targetUri: {
              type: 'string',
              format: 'at-uri',
              description: 'Filter by target node AT-URI',
            },
            relationSlug: {
              type: 'string',
              description: 'Filter by relation type slug',
            },
            status: {
              type: 'string',
              knownValues: ['proposed', 'established', 'deprecated'],
              description: 'Filter by lifecycle status',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Maximum results to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['edges', 'hasMore', 'total'],
            properties: {
              edges: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.graph.getEdge#graphEdge',
                },
                description: 'List of edges',
              },
              cursor: {
                type: 'string',
                description: 'Pagination cursor for next page',
              },
              hasMore: {
                type: 'boolean',
                description: 'Whether more results exist',
              },
              total: {
                type: 'integer',
                description: 'Total count of matching edges',
              },
            },
          },
        },
      },
    },
  },
  PubChiveGraphListNodes: {
    lexicon: 1,
    id: 'pub.chive.graph.listNodes',
    defs: {
      main: {
        type: 'query',
        description:
          'List knowledge graph nodes with optional filtering by kind, subkind, and status',
        parameters: {
          type: 'params',
          properties: {
            kind: {
              type: 'string',
              knownValues: ['type', 'object'],
              description: 'Filter by node kind',
            },
            subkind: {
              type: 'string',
              description: 'Filter by subkind slug',
            },
            status: {
              type: 'string',
              knownValues: ['proposed', 'provisional', 'established', 'deprecated'],
              description: 'Filter by lifecycle status',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Maximum results to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['nodes', 'hasMore', 'total'],
            properties: {
              nodes: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.graph.listNodes#graphNode',
                },
                description: 'List of nodes',
              },
              cursor: {
                type: 'string',
                description: 'Pagination cursor for next page',
              },
              hasMore: {
                type: 'boolean',
                description: 'Whether more results exist',
              },
              total: {
                type: 'integer',
                description: 'Total count of matching nodes',
              },
            },
          },
        },
      },
      graphNode: {
        type: 'object',
        description: 'Graph node response',
        required: ['id', 'uri', 'kind', 'label', 'status', 'createdAt'],
        properties: {
          id: {
            type: 'string',
            description: 'Node UUID identifier',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the node',
          },
          cid: {
            type: 'string',
            description: 'Content identifier',
          },
          kind: {
            type: 'string',
            knownValues: ['type', 'object'],
            description: 'Node kind: type or object',
          },
          subkind: {
            type: 'string',
            description: 'Subkind slug (e.g., field, institution)',
          },
          subkindUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the subkind type node',
          },
          label: {
            type: 'string',
            description: 'Primary display label',
          },
          alternateLabels: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Alternate labels/synonyms',
          },
          description: {
            type: 'string',
            description: 'Detailed description',
          },
          externalIds: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.graph.node#externalId',
            },
            description: 'External identifier mappings',
          },
          metadata: {
            type: 'ref',
            ref: 'lex:pub.chive.graph.node#nodeMetadata',
            description: 'Subkind-specific metadata',
          },
          status: {
            type: 'string',
            knownValues: ['proposed', 'provisional', 'established', 'deprecated'],
            description: 'Lifecycle status',
          },
          deprecatedBy: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of superseding node',
          },
          proposalUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of creating proposal',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'Creation timestamp',
          },
          createdBy: {
            type: 'string',
            format: 'did',
            description: 'DID of creator',
          },
          updatedAt: {
            type: 'string',
            format: 'datetime',
            description: 'Last update timestamp',
          },
        },
      },
    },
  },
  PubChiveGraphNode: {
    lexicon: 1,
    id: 'pub.chive.graph.node',
    defs: {
      main: {
        type: 'record',
        description:
          'Unified knowledge graph node combining concepts, organizations, authorities, fields, and facets. All relationships are via edges.',
        key: 'any',
        record: {
          type: 'object',
          required: ['id', 'kind', 'label', 'status', 'createdAt'],
          properties: {
            id: {
              type: 'string',
              description: 'UUID identifier (also used as rkey)',
            },
            slug: {
              type: 'string',
              maxLength: 100,
              description: "Human-readable URL-safe identifier (e.g., 'pdf', 'computer-science')",
            },
            kind: {
              type: 'string',
              knownValues: ['type', 'object'],
              description:
                "Node kind: 'type' for classifications/categories, 'object' for instances",
            },
            subkind: {
              type: 'string',
              maxLength: 50,
              description: "Slug identifying the subkind (e.g., 'field', 'facet', 'institution')",
            },
            subkindUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of the subkind type node',
            },
            label: {
              type: 'string',
              maxLength: 500,
              description: 'Primary display label',
            },
            alternateLabels: {
              type: 'array',
              items: {
                type: 'string',
                maxLength: 500,
              },
              maxLength: 50,
              description: 'Alternate labels, synonyms, translations',
            },
            description: {
              type: 'string',
              maxLength: 2000,
              description: 'Detailed description or scope note',
            },
            externalIds: {
              type: 'array',
              items: {
                type: 'ref',
                ref: 'lex:pub.chive.graph.node#externalId',
              },
              maxLength: 20,
              description: 'External identifier mappings',
            },
            metadata: {
              type: 'ref',
              ref: 'lex:pub.chive.graph.node#nodeMetadata',
              description: 'Subkind-specific metadata',
            },
            status: {
              type: 'string',
              knownValues: ['proposed', 'provisional', 'established', 'deprecated'],
              description: 'Lifecycle status',
            },
            deprecatedBy: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of the node that supersedes this one',
            },
            proposalUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of the proposal that created this node (null for seeded)',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
            createdBy: {
              type: 'string',
              format: 'did',
              description: 'DID of creator or governance',
            },
            updatedAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
      externalId: {
        type: 'object',
        description: 'External identifier mapping',
        required: ['system', 'identifier'],
        properties: {
          system: {
            type: 'string',
            knownValues: [
              'wikidata',
              'ror',
              'orcid',
              'isni',
              'viaf',
              'lcsh',
              'fast',
              'credit',
              'spdx',
              'fundref',
              'mesh',
              'aat',
              'gnd',
              'anzsrc',
            ],
            description: 'Identifier system',
          },
          identifier: {
            type: 'string',
            maxLength: 200,
            description: 'Identifier value',
          },
          uri: {
            type: 'string',
            format: 'uri',
            description: 'Full URI for the identifier',
          },
          matchType: {
            type: 'string',
            knownValues: ['exact', 'close', 'broader', 'narrower', 'related'],
            description: 'SKOS match type',
          },
        },
      },
      nodeMetadata: {
        type: 'object',
        description: 'Subkind-specific metadata fields',
        properties: {
          country: {
            type: 'string',
            maxLength: 2,
            description: 'ISO 3166-1 alpha-2 country code (for institutions)',
          },
          city: {
            type: 'string',
            maxLength: 200,
            description: 'City name (for institutions)',
          },
          website: {
            type: 'string',
            format: 'uri',
            description: 'Official website URL',
          },
          organizationStatus: {
            type: 'string',
            knownValues: ['active', 'merged', 'inactive', 'defunct'],
            description: 'Organization operational status (for institutions)',
          },
          mimeTypes: {
            type: 'array',
            items: {
              type: 'string',
            },
            maxLength: 10,
            description: 'MIME types (for document-format)',
          },
          spdxId: {
            type: 'string',
            maxLength: 100,
            description: 'SPDX license identifier (for licenses)',
          },
          displayOrder: {
            type: 'integer',
            description: 'Display order for UI sorting',
          },
          inverseSlug: {
            type: 'string',
            maxLength: 50,
            description: 'Slug of inverse relation (for relation types)',
          },
        },
      },
    },
  },
  PubChiveGraphNodeProposal: {
    lexicon: 1,
    id: 'pub.chive.graph.nodeProposal',
    defs: {
      main: {
        type: 'record',
        description:
          'Unified proposal for creating, updating, merging, or deprecating knowledge graph nodes (stored in user PDS)',
        key: 'tid',
        record: {
          type: 'object',
          required: ['proposalType', 'kind', 'rationale', 'createdAt'],
          properties: {
            proposalType: {
              type: 'string',
              knownValues: ['create', 'update', 'merge', 'deprecate'],
              description: 'Type of proposal action',
            },
            kind: {
              type: 'string',
              knownValues: ['type', 'object'],
              description: 'Node kind being proposed',
            },
            subkind: {
              type: 'string',
              maxLength: 50,
              description: "Subkind slug (e.g., 'field', 'institution', 'contribution-type')",
            },
            targetUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of node to update/deprecate/merge',
            },
            mergeIntoUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of node to merge into (for merge action)',
            },
            proposedNode: {
              type: 'ref',
              ref: 'lex:pub.chive.graph.nodeProposal#proposedNodeData',
              description: 'Proposed node data (for create/update)',
            },
            rationale: {
              type: 'string',
              maxLength: 2000,
              description: 'Justification for the proposal',
            },
            evidence: {
              type: 'array',
              items: {
                type: 'ref',
                ref: 'lex:pub.chive.graph.nodeProposal#evidence',
              },
              maxLength: 10,
              description: 'Supporting evidence for the proposal',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
      proposedNodeData: {
        type: 'object',
        description: 'Proposed node data',
        required: ['label'],
        properties: {
          label: {
            type: 'string',
            maxLength: 500,
          },
          alternateLabels: {
            type: 'array',
            items: {
              type: 'string',
              maxLength: 500,
            },
            maxLength: 50,
          },
          description: {
            type: 'string',
            maxLength: 2000,
          },
          externalIds: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.graph.node#externalId',
            },
            maxLength: 20,
          },
          metadata: {
            type: 'ref',
            ref: 'lex:pub.chive.graph.node#nodeMetadata',
          },
        },
      },
      evidence: {
        type: 'object',
        description: 'Supporting evidence for a proposal',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
            knownValues: [
              'wikidata',
              'lcsh',
              'fast',
              'ror',
              'credit',
              'usage',
              'citation',
              'external',
              'other',
            ],
            description: 'Evidence type',
          },
          uri: {
            type: 'string',
            format: 'uri',
            description: 'URI to evidence',
          },
          description: {
            type: 'string',
            maxLength: 500,
            description: 'Description of the evidence',
          },
        },
      },
    },
  },
  PubChiveGraphReconciliation: {
    lexicon: 1,
    id: 'pub.chive.graph.reconciliation',
    defs: {
      main: {
        type: 'record',
        description: 'Entity reconciliation record linking local entities to external authorities',
        key: 'tid',
        record: {
          type: 'object',
          required: ['sourceUri', 'targetSystem', 'targetId', 'confidence', 'status', 'createdAt'],
          properties: {
            sourceUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of local entity being reconciled',
            },
            targetSystem: {
              type: 'string',
              knownValues: [
                'wikidata',
                'lcsh',
                'fast',
                'ror',
                'orcid',
                'viaf',
                'gnd',
                'mesh',
                'aat',
                'getty',
              ],
              description: 'External authority system',
            },
            targetId: {
              type: 'string',
              description: 'Identifier in the external system',
            },
            confidence: {
              type: 'integer',
              minimum: 0,
              maximum: 1000,
              description: 'Match confidence score (scaled by 1000 for 0.0-1.0 range)',
            },
            matchType: {
              type: 'string',
              knownValues: ['exact', 'close', 'broad', 'narrow', 'related'],
              description: 'Type of semantic match (SKOS mapping)',
            },
            status: {
              type: 'string',
              knownValues: ['proposed', 'verified', 'rejected'],
              description: 'Reconciliation status',
            },
            verifiedBy: {
              type: 'string',
              format: 'did',
              description: 'DID of user who verified the match',
            },
            notes: {
              type: 'string',
              maxLength: 1000,
              description: 'Notes about the reconciliation',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
            updatedAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  PubChiveGraphSearchNodes: {
    lexicon: 1,
    id: 'pub.chive.graph.searchNodes',
    defs: {
      main: {
        type: 'query',
        description: 'Full-text search for knowledge graph nodes with optional filtering',
        parameters: {
          type: 'params',
          required: ['query'],
          properties: {
            query: {
              type: 'string',
              minLength: 1,
              description: 'Search query',
            },
            kind: {
              type: 'string',
              knownValues: ['type', 'object'],
              description: 'Filter by node kind',
            },
            subkind: {
              type: 'string',
              description: 'Filter by subkind slug',
            },
            status: {
              type: 'string',
              knownValues: ['proposed', 'provisional', 'established', 'deprecated'],
              description: 'Filter by lifecycle status',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: 'Maximum results to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['nodes', 'hasMore', 'total'],
            properties: {
              nodes: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.graph.listNodes#graphNode',
                },
                description: 'Search results',
              },
              cursor: {
                type: 'string',
                description: 'Pagination cursor for next page',
              },
              hasMore: {
                type: 'boolean',
                description: 'Whether more results exist',
              },
              total: {
                type: 'integer',
                description: 'Total count of matching nodes',
              },
            },
          },
        },
      },
    },
  },
  PubChiveGraphVote: {
    lexicon: 1,
    id: 'pub.chive.graph.vote',
    defs: {
      main: {
        type: 'record',
        description: 'Vote on field proposal',
        key: 'tid',
        record: {
          type: 'object',
          required: ['proposalUri', 'vote', 'createdAt'],
          properties: {
            proposalUri: {
              type: 'string',
              format: 'at-uri',
              description: 'Proposal being voted on',
            },
            vote: {
              type: 'string',
              knownValues: ['approve', 'reject'],
            },
            comment: {
              type: 'string',
              maxLength: 500,
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  PubChiveImportExists: {
    lexicon: 1,
    id: 'pub.chive.import.exists',
    defs: {
      main: {
        type: 'query',
        description: 'Check if an eprint has been imported from an external source',
        parameters: {
          type: 'params',
          required: ['source', 'externalId'],
          properties: {
            source: {
              type: 'string',
              minLength: 2,
              maxLength: 50,
              description: 'External source identifier (e.g., arxiv, biorxiv, semanticscholar)',
            },
            externalId: {
              type: 'string',
              minLength: 1,
              description: 'Source-specific identifier for the eprint',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['exists'],
            properties: {
              exists: {
                type: 'boolean',
                description: 'Whether the eprint has been imported',
              },
            },
          },
        },
      },
    },
  },
  PubChiveImportGet: {
    lexicon: 1,
    id: 'pub.chive.import.get',
    defs: {
      main: {
        type: 'query',
        description: 'Get an imported eprint by source and external ID',
        parameters: {
          type: 'params',
          required: ['source', 'externalId'],
          properties: {
            source: {
              type: 'string',
              minLength: 2,
              maxLength: 50,
              description: 'External source identifier (e.g., arxiv, biorxiv, semanticscholar)',
            },
            externalId: {
              type: 'string',
              minLength: 1,
              description: 'Source-specific identifier for the eprint',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:pub.chive.import.get#importedEprint',
          },
        },
        errors: [
          {
            name: 'NotFound',
            description: 'The imported eprint was not found',
          },
        ],
      },
      importedEprint: {
        type: 'object',
        description: 'An eprint imported from an external source',
        required: [
          'id',
          'source',
          'externalId',
          'url',
          'title',
          'authors',
          'importedByPlugin',
          'importedAt',
          'syncStatus',
          'claimStatus',
        ],
        properties: {
          id: {
            type: 'integer',
            description: 'Internal import ID',
          },
          source: {
            type: 'string',
            description: 'External source identifier',
          },
          externalId: {
            type: 'string',
            description: 'Source-specific identifier',
          },
          url: {
            type: 'string',
            format: 'uri',
            description: 'URL to the eprint on the external source',
          },
          title: {
            type: 'string',
            description: 'Eprint title',
          },
          abstract: {
            type: 'string',
            description: 'Abstract text',
          },
          authors: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.import.get#externalAuthor',
            },
            description: 'Author list',
          },
          publicationDate: {
            type: 'string',
            format: 'datetime',
            description: 'Publication date',
          },
          categories: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Subject categories',
          },
          doi: {
            type: 'string',
            description: 'DOI if assigned',
          },
          pdfUrl: {
            type: 'string',
            format: 'uri',
            description: 'URL to PDF',
          },
          importedByPlugin: {
            type: 'string',
            description: 'Plugin that imported this eprint',
          },
          importedAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the eprint was imported',
          },
          lastSyncedAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the eprint was last synced',
          },
          syncStatus: {
            type: 'string',
            knownValues: ['active', 'stale', 'unavailable'],
            description: 'Current sync status',
          },
          claimStatus: {
            type: 'string',
            knownValues: ['unclaimed', 'pending', 'claimed'],
            description: 'Current claim status',
          },
          canonicalUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the canonical record if claimed',
          },
          claimedByDid: {
            type: 'string',
            format: 'did',
            description: 'DID of the user who claimed this eprint',
          },
          claimedAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the eprint was claimed',
          },
        },
      },
      externalAuthor: {
        type: 'object',
        description: 'An author from an external source',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Author name',
          },
          orcid: {
            type: 'string',
            description: 'ORCID identifier',
          },
          affiliation: {
            type: 'string',
            description: 'Institutional affiliation',
          },
          email: {
            type: 'string',
            description: 'Email address',
          },
        },
      },
    },
  },
  PubChiveImportSearch: {
    lexicon: 1,
    id: 'pub.chive.import.search',
    defs: {
      main: {
        type: 'query',
        description: 'Search imported eprints in the AppView cache',
        parameters: {
          type: 'params',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for title, abstract, or author',
            },
            source: {
              type: 'string',
              minLength: 2,
              maxLength: 50,
              description: 'Filter by external source identifier',
            },
            claimStatus: {
              type: 'string',
              knownValues: ['unclaimed', 'pending', 'claimed'],
              description: 'Filter by claim status',
            },
            authorName: {
              type: 'string',
              description: 'Filter by author name',
            },
            authorOrcid: {
              type: 'string',
              description: 'Filter by author ORCID',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Maximum results to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['eprints', 'hasMore'],
            properties: {
              eprints: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.import.search#importedEprint',
                },
                description: 'List of matching imported eprints',
              },
              cursor: {
                type: 'string',
                description: 'Cursor for next page',
              },
              hasMore: {
                type: 'boolean',
                description: 'Whether more results are available',
              },
            },
          },
        },
      },
      importedEprint: {
        type: 'object',
        description: 'An eprint imported from an external source',
        required: [
          'id',
          'source',
          'externalId',
          'url',
          'title',
          'authors',
          'importedByPlugin',
          'importedAt',
          'syncStatus',
          'claimStatus',
        ],
        properties: {
          id: {
            type: 'integer',
            description: 'Internal import ID',
          },
          source: {
            type: 'string',
            description: 'External source identifier',
          },
          externalId: {
            type: 'string',
            description: 'Source-specific identifier',
          },
          url: {
            type: 'string',
            format: 'uri',
            description: 'URL to the eprint on the external source',
          },
          title: {
            type: 'string',
            description: 'Eprint title',
          },
          abstract: {
            type: 'string',
            description: 'Abstract text',
          },
          authors: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.import.search#externalAuthor',
            },
            description: 'Author list',
          },
          publicationDate: {
            type: 'string',
            format: 'datetime',
            description: 'Publication date',
          },
          categories: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Subject categories',
          },
          doi: {
            type: 'string',
            description: 'DOI if assigned',
          },
          pdfUrl: {
            type: 'string',
            format: 'uri',
            description: 'URL to PDF',
          },
          importedByPlugin: {
            type: 'string',
            description: 'Plugin that imported this eprint',
          },
          importedAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the eprint was imported',
          },
          lastSyncedAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the eprint was last synced',
          },
          syncStatus: {
            type: 'string',
            knownValues: ['active', 'stale', 'unavailable'],
            description: 'Current sync status',
          },
          claimStatus: {
            type: 'string',
            knownValues: ['unclaimed', 'pending', 'claimed'],
            description: 'Current claim status',
          },
          canonicalUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the canonical record if claimed',
          },
          claimedByDid: {
            type: 'string',
            format: 'did',
            description: 'DID of the user who claimed this eprint',
          },
          claimedAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the eprint was claimed',
          },
        },
      },
      externalAuthor: {
        type: 'object',
        description: 'An author from an external source',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Author name',
          },
          orcid: {
            type: 'string',
            description: 'ORCID identifier',
          },
          affiliation: {
            type: 'string',
            description: 'Institutional affiliation',
          },
          email: {
            type: 'string',
            description: 'Email address',
          },
        },
      },
    },
  },
  PubChiveMetricsGetMetrics: {
    lexicon: 1,
    id: 'pub.chive.metrics.getMetrics',
    defs: {
      main: {
        type: 'query',
        description: 'Get comprehensive metrics for an eprint',
        parameters: {
          type: 'params',
          required: ['uri'],
          properties: {
            uri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of the eprint',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: [
              'totalViews',
              'uniqueViews',
              'totalDownloads',
              'views24h',
              'views7d',
              'views30d',
            ],
            properties: {
              totalViews: {
                type: 'integer',
                minimum: 0,
                description: 'Total view count',
              },
              uniqueViews: {
                type: 'integer',
                minimum: 0,
                description: 'Unique viewer count',
              },
              totalDownloads: {
                type: 'integer',
                minimum: 0,
                description: 'Total download count',
              },
              views24h: {
                type: 'integer',
                minimum: 0,
                description: 'Views in last 24 hours',
              },
              views7d: {
                type: 'integer',
                minimum: 0,
                description: 'Views in last 7 days',
              },
              views30d: {
                type: 'integer',
                minimum: 0,
                description: 'Views in last 30 days',
              },
            },
          },
        },
        errors: [
          {
            name: 'NotFound',
          },
        ],
      },
    },
  },
  PubChiveMetricsGetTrending: {
    lexicon: 1,
    id: 'pub.chive.metrics.getTrending',
    defs: {
      main: {
        type: 'query',
        description: 'Get trending eprints based on view counts within a time window',
        parameters: {
          type: 'params',
          properties: {
            window: {
              type: 'string',
              description: 'Time window for trending calculation',
              enum: ['24h', '7d', '30d'],
              default: '7d',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: 'Maximum number of results to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['trending', 'window', 'hasMore'],
            properties: {
              trending: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.metrics.getTrending#trendingEntry',
                },
              },
              window: {
                type: 'string',
                description: 'Time window used',
                enum: ['24h', '7d', '30d'],
              },
              cursor: {
                type: 'string',
                description: 'Cursor for next page',
              },
              hasMore: {
                type: 'boolean',
                description: 'Whether more results are available',
              },
            },
          },
        },
        errors: [],
      },
      trendingEntry: {
        type: 'object',
        description: 'A trending eprint entry with full metadata',
        required: [
          'uri',
          'cid',
          'title',
          'abstract',
          'authors',
          'submittedBy',
          'license',
          'createdAt',
          'indexedAt',
          'source',
          'viewsInWindow',
          'rank',
        ],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the eprint',
          },
          cid: {
            type: 'string',
            format: 'cid',
            description: 'CID of the eprint record',
          },
          title: {
            type: 'string',
            description: 'Eprint title',
          },
          abstract: {
            type: 'string',
            description: 'Truncated abstract (max 500 chars)',
          },
          authors: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.metrics.getTrending#authorRef',
            },
          },
          submittedBy: {
            type: 'string',
            format: 'did',
            description: 'DID of the submitter',
          },
          paperDid: {
            type: 'string',
            format: 'did',
            description: 'DID of the paper identity (if using paper-centric model)',
          },
          fields: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.metrics.getTrending#fieldRef',
            },
            description: 'Knowledge graph field classifications',
          },
          license: {
            type: 'string',
            description: 'License identifier',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'Original creation timestamp',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
            description: 'When Chive indexed this record',
          },
          source: {
            type: 'ref',
            ref: 'lex:pub.chive.metrics.getTrending#sourceInfo',
            description: 'PDS source information for transparency',
          },
          metrics: {
            type: 'ref',
            ref: 'lex:pub.chive.metrics.getTrending#eprintMetrics',
            description: 'Current metrics snapshot',
          },
          viewsInWindow: {
            type: 'integer',
            minimum: 0,
            description: 'Views within the trending window',
          },
          rank: {
            type: 'integer',
            minimum: 1,
            description: 'Position in trending list',
          },
          velocity: {
            type: 'integer',
            description: 'Rate of view increase (optional)',
          },
        },
      },
      authorRef: {
        type: 'object',
        description: 'Reference to an author with optional ATProto identity',
        required: ['name', 'order', 'affiliations', 'contributions'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
            description: 'Author DID (if linked to ATProto identity)',
          },
          name: {
            type: 'string',
            description: 'Display name',
          },
          orcid: {
            type: 'string',
            description: 'ORCID identifier',
          },
          email: {
            type: 'string',
            description: 'Contact email',
          },
          order: {
            type: 'integer',
            minimum: 1,
            description: 'Author order position',
          },
          affiliations: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.metrics.getTrending#affiliation',
            },
          },
          contributions: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.metrics.getTrending#contribution',
            },
          },
          isCorrespondingAuthor: {
            type: 'boolean',
            description: 'Whether this is the corresponding author',
          },
          isHighlighted: {
            type: 'boolean',
            description: 'Whether to highlight this author',
          },
          handle: {
            type: 'string',
            description: 'ATProto handle (if resolved)',
          },
          avatarUrl: {
            type: 'string',
            description: 'Avatar URL (if available)',
          },
        },
      },
      affiliation: {
        type: 'object',
        description: 'Author affiliation',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Institution name',
          },
          rorId: {
            type: 'string',
            description: 'ROR identifier',
          },
          department: {
            type: 'string',
            description: 'Department name',
          },
        },
      },
      contribution: {
        type: 'object',
        description: 'CRediT contribution role',
        required: ['typeUri', 'typeId', 'typeLabel'],
        properties: {
          typeUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the contribution type node',
          },
          typeId: {
            type: 'string',
            description: 'Contribution type slug',
          },
          typeLabel: {
            type: 'string',
            description: 'Human-readable contribution label',
          },
          degree: {
            type: 'string',
            description: 'Degree of contribution (lead, supporting, equal)',
          },
        },
      },
      fieldRef: {
        type: 'object',
        description: 'Reference to a knowledge graph field node',
        required: ['uri', 'label'],
        properties: {
          id: {
            type: 'string',
            description: 'Field ID',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the field node',
          },
          label: {
            type: 'string',
            description: 'Display label',
          },
          parentUri: {
            type: 'string',
            format: 'at-uri',
            description: 'Parent field URI',
          },
        },
      },
      sourceInfo: {
        type: 'object',
        description: 'PDS source information for data transparency',
        required: ['pdsEndpoint', 'recordUrl', 'lastVerifiedAt', 'stale'],
        properties: {
          pdsEndpoint: {
            type: 'string',
            description: 'URL of the source PDS',
          },
          recordUrl: {
            type: 'string',
            description: 'Direct URL to fetch the record',
          },
          blobUrl: {
            type: 'string',
            description: 'URL to fetch associated blob',
          },
          lastVerifiedAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the record was last verified',
          },
          stale: {
            type: 'boolean',
            description: 'Whether the indexed data may be stale',
          },
        },
      },
      eprintMetrics: {
        type: 'object',
        description: 'Current metrics for the eprint',
        required: ['views', 'downloads'],
        properties: {
          views: {
            type: 'integer',
            minimum: 0,
            description: 'Total view count',
          },
          downloads: {
            type: 'integer',
            minimum: 0,
            description: 'Total download count',
          },
          endorsements: {
            type: 'integer',
            minimum: 0,
            description: 'Endorsement count',
          },
        },
      },
    },
  },
  PubChiveMetricsGetViewCount: {
    lexicon: 1,
    id: 'pub.chive.metrics.getViewCount',
    defs: {
      main: {
        type: 'query',
        description: 'Get simple view count for an eprint',
        parameters: {
          type: 'params',
          required: ['uri'],
          properties: {
            uri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of the eprint',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['count'],
            properties: {
              count: {
                type: 'integer',
                minimum: 0,
                description: 'Total view count',
              },
            },
          },
        },
        errors: [
          {
            name: 'NotFound',
          },
        ],
      },
    },
  },
  PubChiveMetricsRecordDownload: {
    lexicon: 1,
    id: 'pub.chive.metrics.recordDownload',
    defs: {
      main: {
        type: 'procedure',
        description: 'Record a download event for an eprint',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['uri'],
            properties: {
              uri: {
                type: 'string',
                format: 'at-uri',
                description: 'AT-URI of the eprint being downloaded',
              },
              viewerDid: {
                type: 'string',
                format: 'did',
                description: 'DID of the downloader (optional for anonymous downloads)',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['success'],
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the download was recorded',
              },
            },
          },
        },
        errors: [
          {
            name: 'InvalidRequest',
          },
          {
            name: 'NotFound',
          },
        ],
      },
    },
  },
  PubChiveMetricsRecordDwellTime: {
    lexicon: 1,
    id: 'pub.chive.metrics.recordDwellTime',
    defs: {
      main: {
        type: 'procedure',
        description: 'Record dwell time for a clicked search result (called via beacon API)',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['impressionId', 'uri', 'dwellTimeMs'],
            properties: {
              impressionId: {
                type: 'string',
                description: 'UUID of the search impression',
              },
              uri: {
                type: 'string',
                format: 'at-uri',
                description: 'AT-URI of the viewed eprint',
              },
              dwellTimeMs: {
                type: 'integer',
                minimum: 0,
                description: 'Time spent on the page in milliseconds',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['success'],
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the dwell time was recorded',
              },
            },
          },
        },
        errors: [
          {
            name: 'InvalidRequest',
          },
        ],
      },
    },
  },
  PubChiveMetricsRecordSearchClick: {
    lexicon: 1,
    id: 'pub.chive.metrics.recordSearchClick',
    defs: {
      main: {
        type: 'procedure',
        description: 'Record a click event on a search result for LTR training data',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['impressionId', 'uri', 'position'],
            properties: {
              impressionId: {
                type: 'string',
                description: 'UUID of the search impression',
              },
              uri: {
                type: 'string',
                format: 'at-uri',
                description: 'AT-URI of the clicked eprint',
              },
              position: {
                type: 'integer',
                minimum: 0,
                description: 'Position of the result in the search results list',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['success'],
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the click was recorded',
              },
            },
          },
        },
        errors: [
          {
            name: 'InvalidRequest',
          },
        ],
      },
    },
  },
  PubChiveMetricsRecordSearchDownload: {
    lexicon: 1,
    id: 'pub.chive.metrics.recordSearchDownload',
    defs: {
      main: {
        type: 'procedure',
        description:
          'Record a download event from a search result (strong positive relevance signal)',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['impressionId', 'uri'],
            properties: {
              impressionId: {
                type: 'string',
                description: 'UUID of the search impression',
              },
              uri: {
                type: 'string',
                format: 'at-uri',
                description: 'AT-URI of the downloaded eprint',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['success'],
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the download was recorded',
              },
            },
          },
        },
        errors: [
          {
            name: 'InvalidRequest',
          },
        ],
      },
    },
  },
  PubChiveMetricsRecordView: {
    lexicon: 1,
    id: 'pub.chive.metrics.recordView',
    defs: {
      main: {
        type: 'procedure',
        description: 'Record a view event for an eprint',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['uri'],
            properties: {
              uri: {
                type: 'string',
                format: 'at-uri',
                description: 'AT-URI of the eprint being viewed',
              },
              viewerDid: {
                type: 'string',
                format: 'did',
                description: 'DID of the viewer (optional for anonymous views)',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['success'],
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the view was recorded',
              },
            },
          },
        },
        errors: [
          {
            name: 'InvalidRequest',
          },
          {
            name: 'NotFound',
          },
        ],
      },
    },
  },
  PubChiveNotificationListEndorsementsOnMyPapers: {
    lexicon: 1,
    id: 'pub.chive.notification.listEndorsementsOnMyPapers',
    defs: {
      main: {
        type: 'query',
        description: 'List endorsements on papers authored by the current user',
        parameters: {
          type: 'params',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 25,
            },
            cursor: {
              type: 'string',
            },
            unreadOnly: {
              type: 'boolean',
              default: false,
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['notifications'],
            properties: {
              notifications: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.notification.listEndorsementsOnMyPapers#endorsementNotification',
                },
              },
              cursor: {
                type: 'string',
              },
              unreadCount: {
                type: 'integer',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
        ],
      },
      endorsementNotification: {
        type: 'object',
        required: ['uri', 'eprintUri', 'endorser', 'contributions', 'createdAt'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          eprintUri: {
            type: 'string',
            format: 'at-uri',
          },
          eprintTitle: {
            type: 'string',
          },
          endorser: {
            type: 'ref',
            ref: 'lex:pub.chive.notification.listEndorsementsOnMyPapers#authorRef',
          },
          contributions: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          comment: {
            type: 'string',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
          isRead: {
            type: 'boolean',
          },
        },
      },
      authorRef: {
        type: 'object',
        required: ['did'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
          },
          avatar: {
            type: 'string',
            format: 'uri',
          },
        },
      },
    },
  },
  PubChiveNotificationListReviewsOnMyPapers: {
    lexicon: 1,
    id: 'pub.chive.notification.listReviewsOnMyPapers',
    defs: {
      main: {
        type: 'query',
        description: 'List reviews/comments on papers authored by the current user',
        parameters: {
          type: 'params',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 25,
              description: 'Maximum results to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor',
            },
            unreadOnly: {
              type: 'boolean',
              default: false,
              description: 'Only return unread notifications',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['notifications'],
            properties: {
              notifications: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.notification.listReviewsOnMyPapers#reviewNotification',
                },
              },
              cursor: {
                type: 'string',
              },
              unreadCount: {
                type: 'integer',
              },
            },
          },
        },
        errors: [
          {
            name: 'AuthenticationRequired',
          },
        ],
      },
      reviewNotification: {
        type: 'object',
        required: ['uri', 'eprintUri', 'reviewer', 'createdAt'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'Review AT-URI',
          },
          eprintUri: {
            type: 'string',
            format: 'at-uri',
          },
          eprintTitle: {
            type: 'string',
          },
          reviewer: {
            type: 'ref',
            ref: 'lex:pub.chive.notification.listReviewsOnMyPapers#authorRef',
          },
          preview: {
            type: 'string',
            description: 'Preview of review content',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
          isRead: {
            type: 'boolean',
          },
        },
      },
      authorRef: {
        type: 'object',
        required: ['did'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
          },
          avatar: {
            type: 'string',
            format: 'uri',
          },
        },
      },
    },
  },
  PubChiveReviewComment: {
    lexicon: 1,
    id: 'pub.chive.review.comment',
    defs: {
      main: {
        type: 'record',
        description:
          'Review comment on preprint with rich body supporting text and node references',
        key: 'tid',
        record: {
          type: 'object',
          required: ['eprintUri', 'body', 'createdAt'],
          properties: {
            eprintUri: {
              type: 'string',
              format: 'at-uri',
              description: 'Reviewed eprint URI',
            },
            body: {
              type: 'array',
              description: 'Rich body content with text and node references',
              items: {
                type: 'union',
                refs: [
                  'lex:pub.chive.review.comment#textItem',
                  'lex:pub.chive.review.comment#nodeRefItem',
                  'lex:pub.chive.review.comment#eprintRefItem',
                ],
              },
              maxLength: 100,
            },
            target: {
              type: 'ref',
              ref: 'lex:pub.chive.review.comment#textSpanTarget',
              description: 'Target text span for inline annotations',
            },
            motivationUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of motivation type node (subkind=motivation)',
            },
            motivationFallback: {
              type: 'string',
              knownValues: ['commenting', 'questioning', 'highlighting', 'replying', 'linking'],
              description: 'Fallback motivation if motivationUri not available',
            },
            parentComment: {
              type: 'string',
              format: 'at-uri',
              description: 'Parent comment for threading',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
      textItem: {
        type: 'object',
        description: 'Plain text content item',
        required: ['type', 'content'],
        properties: {
          type: {
            type: 'string',
            const: 'text',
          },
          content: {
            type: 'string',
            maxLength: 10000,
          },
        },
      },
      nodeRefItem: {
        type: 'object',
        description: 'Reference to a knowledge graph node',
        required: ['type', 'uri'],
        properties: {
          type: {
            type: 'string',
            const: 'nodeRef',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the referenced node',
          },
          label: {
            type: 'string',
            maxLength: 500,
            description: 'Display label (cached from node)',
          },
          subkind: {
            type: 'string',
            maxLength: 50,
            description: 'Subkind slug for styling',
          },
        },
      },
      eprintRefItem: {
        type: 'object',
        description: 'Reference to another eprint',
        required: ['type', 'uri'],
        properties: {
          type: {
            type: 'string',
            const: 'eprintRef',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the referenced eprint',
          },
          title: {
            type: 'string',
            maxLength: 500,
            description: 'Eprint title (cached)',
          },
        },
      },
      textSpanTarget: {
        type: 'object',
        description: 'Target text span for inline annotations (W3C Web Annotation compatible)',
        required: ['selector'],
        properties: {
          versionUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of specific eprint version',
          },
          selector: {
            type: 'union',
            refs: [
              'lex:pub.chive.review.comment#textQuoteSelector',
              'lex:pub.chive.review.comment#textPositionSelector',
              'lex:pub.chive.review.comment#fragmentSelector',
            ],
          },
        },
      },
      textQuoteSelector: {
        type: 'object',
        description: 'W3C Text Quote Selector',
        required: ['type', 'exact'],
        properties: {
          type: {
            type: 'string',
            const: 'TextQuoteSelector',
          },
          exact: {
            type: 'string',
            maxLength: 1000,
          },
          prefix: {
            type: 'string',
            maxLength: 100,
          },
          suffix: {
            type: 'string',
            maxLength: 100,
          },
        },
      },
      textPositionSelector: {
        type: 'object',
        description: 'W3C Text Position Selector',
        required: ['type', 'start', 'end'],
        properties: {
          type: {
            type: 'string',
            const: 'TextPositionSelector',
          },
          start: {
            type: 'integer',
            minimum: 0,
          },
          end: {
            type: 'integer',
            minimum: 0,
          },
        },
      },
      fragmentSelector: {
        type: 'object',
        description: 'W3C Fragment Selector',
        required: ['type', 'value'],
        properties: {
          type: {
            type: 'string',
            const: 'FragmentSelector',
          },
          value: {
            type: 'string',
            maxLength: 200,
            description: 'Fragment identifier (e.g., page number, section ID)',
          },
          conformsTo: {
            type: 'string',
            format: 'uri',
            description: 'Fragment syntax specification',
          },
        },
      },
    },
  },
  PubChiveReviewEndorsement: {
    lexicon: 1,
    id: 'pub.chive.review.endorsement',
    defs: {
      main: {
        type: 'record',
        description: 'Endorsement of one or more contribution types in a preprint',
        key: 'tid',
        record: {
          type: 'object',
          required: ['eprintUri', 'contributions', 'createdAt'],
          properties: {
            eprintUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of the eprint being endorsed',
            },
            contributions: {
              type: 'array',
              description: 'Set of contribution types being endorsed (min 1, no duplicates)',
              minLength: 1,
              maxLength: 15,
              items: {
                type: 'string',
                knownValues: [
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
                ],
              },
            },
            comment: {
              type: 'string',
              maxLength: 5000,
              description: 'Optional comment explaining the endorsement',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  PubChiveReviewEntityLink: {
    lexicon: 1,
    id: 'pub.chive.review.entityLink',
    defs: {
      main: {
        type: 'record',
        description: 'Link from a text span in a preprint to a knowledge graph entity',
        key: 'tid',
        record: {
          type: 'object',
          required: ['eprintUri', 'target', 'linkedEntity', 'createdAt'],
          properties: {
            eprintUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of the eprint containing the linked text',
            },
            target: {
              type: 'ref',
              ref: 'lex:pub.chive.review.entityLink#textSpanTarget',
              description: 'Text span being linked to an entity',
            },
            linkedEntity: {
              type: 'union',
              refs: [
                'lex:pub.chive.review.entityLink#graphNodeLink',
                'lex:pub.chive.review.entityLink#externalIdLink',
                'lex:pub.chive.review.entityLink#authorLink',
                'lex:pub.chive.review.entityLink#eprintLink',
              ],
              description: 'The entity being linked to',
            },
            confidence: {
              type: 'integer',
              minimum: 0,
              maximum: 1000,
              description: 'Confidence score for the link (scaled by 1000 for 0.0-1.0 range)',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
      textSpanTarget: {
        type: 'object',
        description: 'W3C Web Annotation target for text spans',
        required: ['source', 'selector'],
        properties: {
          source: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the source document',
          },
          selector: {
            type: 'ref',
            ref: 'lex:pub.chive.review.entityLink#textQuoteSelector',
            description: 'Primary selector for resilient text matching',
          },
          refinedBy: {
            type: 'ref',
            ref: 'lex:pub.chive.review.entityLink#textPositionSelector',
            description: 'Optional position selector for precise targeting',
          },
        },
      },
      textQuoteSelector: {
        type: 'object',
        description: 'W3C TextQuoteSelector for resilient text matching',
        required: ['type', 'exact'],
        properties: {
          type: {
            type: 'string',
            const: 'TextQuoteSelector',
          },
          exact: {
            type: 'string',
            description: 'The exact text to match',
          },
          prefix: {
            type: 'string',
            maxLength: 32,
            description: 'Text immediately before the match',
          },
          suffix: {
            type: 'string',
            maxLength: 32,
            description: 'Text immediately after the match',
          },
        },
      },
      textPositionSelector: {
        type: 'object',
        description: 'W3C TextPositionSelector for character-based targeting',
        required: ['type', 'start', 'end', 'pageNumber'],
        properties: {
          type: {
            type: 'string',
            const: 'TextPositionSelector',
          },
          start: {
            type: 'integer',
            minimum: 0,
            description: 'Start character offset',
          },
          end: {
            type: 'integer',
            minimum: 0,
            description: 'End character offset',
          },
          pageNumber: {
            type: 'integer',
            minimum: 1,
            description: 'Page number in the document',
          },
        },
      },
      graphNodeLink: {
        type: 'object',
        description: 'Link to a knowledge graph node (type or object, with optional subkind)',
        required: ['type', 'uri', 'label', 'kind'],
        properties: {
          type: {
            type: 'string',
            const: 'graphNode',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the graph node',
          },
          id: {
            type: 'string',
            description: 'Node UUID identifier',
          },
          slug: {
            type: 'string',
            description: "Human-readable slug (e.g., 'computer-science')",
          },
          label: {
            type: 'string',
            description: 'Display label for the node',
          },
          kind: {
            type: 'string',
            knownValues: ['type', 'object'],
            description: "Node kind: 'type' for classifications, 'object' for instances",
          },
          subkind: {
            type: 'string',
            description:
              "Subkind slug (e.g., 'field', 'facet', 'institution', 'contribution-type')",
          },
          subkindUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the subkind type node',
          },
        },
      },
      externalIdLink: {
        type: 'object',
        description: 'Link to an external identifier (Wikidata, ROR, ORCID, etc.)',
        required: ['type', 'system', 'identifier', 'label'],
        properties: {
          type: {
            type: 'string',
            const: 'externalId',
          },
          system: {
            type: 'string',
            knownValues: [
              'wikidata',
              'ror',
              'orcid',
              'isni',
              'viaf',
              'lcsh',
              'fast',
              'credit',
              'spdx',
              'fundref',
              'mesh',
              'aat',
              'gnd',
              'anzsrc',
              'arxiv',
              'doi',
              'pmid',
              'pmcid',
            ],
            description: 'External identifier system',
          },
          identifier: {
            type: 'string',
            description: 'Identifier value (e.g., Q42 for Wikidata)',
          },
          label: {
            type: 'string',
            description: 'Display label for the entity',
          },
          uri: {
            type: 'string',
            format: 'uri',
            description: 'Full URI for the external entity',
          },
        },
      },
      authorLink: {
        type: 'object',
        description: 'Link to an ATProto author',
        required: ['type', 'did', 'displayName'],
        properties: {
          type: {
            type: 'string',
            const: 'author',
          },
          did: {
            type: 'string',
            format: 'did',
            description: "Author's DID",
          },
          handle: {
            type: 'string',
            format: 'handle',
            description: "Author's handle",
          },
          displayName: {
            type: 'string',
            description: "Author's display name",
          },
          orcid: {
            type: 'string',
            description: "Author's ORCID (if available)",
          },
        },
      },
      eprintLink: {
        type: 'object',
        description: 'Link to another eprint/preprint',
        required: ['type', 'uri', 'title'],
        properties: {
          type: {
            type: 'string',
            const: 'eprint',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the eprint',
          },
          title: {
            type: 'string',
            description: 'Eprint title',
          },
          doi: {
            type: 'string',
            description: 'DOI if available',
          },
        },
      },
    },
  },
  PubChiveReviewGetThread: {
    lexicon: 1,
    id: 'pub.chive.review.getThread',
    defs: {
      main: {
        type: 'query',
        description: 'Get a review thread including the root review and all replies',
        parameters: {
          type: 'params',
          required: ['uri'],
          properties: {
            uri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of the root review',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['parent', 'replies', 'totalReplies'],
            properties: {
              parent: {
                type: 'ref',
                ref: 'lex:pub.chive.review.getThread#reviewView',
                description: 'Root review of the thread',
              },
              replies: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.review.getThread#reviewView',
                },
                description: 'Direct replies to the root review',
              },
              totalReplies: {
                type: 'integer',
                minimum: 0,
                description: 'Total number of replies in the thread',
              },
            },
          },
        },
        errors: [
          {
            name: 'NotFound',
            description: 'Review not found',
          },
        ],
      },
      reviewView: {
        type: 'object',
        description: 'View of a review/comment',
        required: [
          'uri',
          'cid',
          'author',
          'eprintUri',
          'content',
          'motivation',
          'replyCount',
          'createdAt',
          'indexedAt',
        ],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'Review AT-URI',
          },
          cid: {
            type: 'string',
            description: 'Content identifier',
          },
          author: {
            type: 'ref',
            ref: 'lex:pub.chive.review.getThread#authorRef',
          },
          eprintUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the eprint being reviewed',
          },
          content: {
            type: 'string',
            description: 'Plain text content of the review',
          },
          body: {
            type: 'ref',
            ref: 'lex:pub.chive.review.getThread#annotationBody',
            description: 'Rich text body with facets',
          },
          target: {
            type: 'ref',
            ref: 'lex:pub.chive.review.getThread#textSpanTarget',
            description: 'Target text span for inline annotations',
          },
          motivation: {
            type: 'string',
            knownValues: [
              'commenting',
              'highlighting',
              'questioning',
              'replying',
              'assessing',
              'bookmarking',
              'classifying',
              'describing',
              'editing',
              'linking',
              'moderating',
              'tagging',
            ],
            description: 'W3C Web Annotation motivation',
          },
          parentReviewUri: {
            type: 'string',
            format: 'at-uri',
            description: 'Parent review URI for threaded replies',
          },
          replyCount: {
            type: 'integer',
            minimum: 0,
            description: 'Number of direct replies',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the review was created',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the review was indexed',
          },
        },
      },
      authorRef: {
        type: 'object',
        required: ['did'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
          },
          avatar: {
            type: 'string',
            format: 'uri',
          },
        },
      },
      annotationBody: {
        type: 'object',
        description: 'Rich text body with optional facets',
        required: ['text'],
        properties: {
          text: {
            type: 'string',
            maxLength: 10000,
            description: 'Plain text content',
          },
          facets: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.review.getThread#richTextFacet',
            },
            description: 'Rich text facets for mentions, links, and tags',
          },
        },
      },
      richTextFacet: {
        type: 'object',
        required: ['index', 'features'],
        properties: {
          index: {
            type: 'ref',
            ref: 'lex:pub.chive.review.getThread#byteSlice',
          },
          features: {
            type: 'array',
            items: {
              type: 'union',
              refs: [
                'lex:pub.chive.review.getThread#mentionFacet',
                'lex:pub.chive.review.getThread#linkFacet',
                'lex:pub.chive.review.getThread#tagFacet',
              ],
            },
          },
        },
      },
      byteSlice: {
        type: 'object',
        description: 'Byte slice for facet positioning',
        required: ['byteStart', 'byteEnd'],
        properties: {
          byteStart: {
            type: 'integer',
            minimum: 0,
          },
          byteEnd: {
            type: 'integer',
            minimum: 0,
          },
        },
      },
      mentionFacet: {
        type: 'object',
        required: ['did'],
        properties: {
          $type: {
            type: 'string',
            const: 'app.bsky.richtext.facet#mention',
          },
          did: {
            type: 'string',
            format: 'did',
          },
        },
      },
      linkFacet: {
        type: 'object',
        required: ['uri'],
        properties: {
          $type: {
            type: 'string',
            const: 'app.bsky.richtext.facet#link',
          },
          uri: {
            type: 'string',
            format: 'uri',
          },
        },
      },
      tagFacet: {
        type: 'object',
        required: ['tag'],
        properties: {
          $type: {
            type: 'string',
            const: 'app.bsky.richtext.facet#tag',
          },
          tag: {
            type: 'string',
          },
        },
      },
      textSpanTarget: {
        type: 'object',
        description: 'Target text span for inline annotations (W3C Web Annotation compatible)',
        required: ['source'],
        properties: {
          source: {
            type: 'string',
            format: 'at-uri',
            description: 'Eprint AT-URI',
          },
          selector: {
            type: 'ref',
            ref: 'lex:pub.chive.review.getThread#textQuoteSelector',
            description: 'Text quote selector',
          },
          refinedBy: {
            type: 'ref',
            ref: 'lex:pub.chive.review.getThread#textPositionSelector',
            description: 'Position refinement with page info',
          },
          page: {
            type: 'integer',
            minimum: 1,
            description: 'Page number (deprecated, use refinedBy.pageNumber)',
          },
        },
      },
      textQuoteSelector: {
        type: 'object',
        description: 'W3C Text Quote Selector',
        required: ['type', 'exact'],
        properties: {
          type: {
            type: 'string',
            const: 'TextQuoteSelector',
          },
          exact: {
            type: 'string',
            maxLength: 1000,
          },
          prefix: {
            type: 'string',
            maxLength: 100,
          },
          suffix: {
            type: 'string',
            maxLength: 100,
          },
        },
      },
      textPositionSelector: {
        type: 'object',
        description: 'W3C Text Position Selector with optional page info',
        required: ['type', 'start', 'end'],
        properties: {
          type: {
            type: 'string',
            const: 'TextPositionSelector',
          },
          start: {
            type: 'integer',
            minimum: 0,
          },
          end: {
            type: 'integer',
            minimum: 0,
          },
          pageNumber: {
            type: 'integer',
            minimum: 1,
            description: 'Page number in PDF',
          },
        },
      },
    },
  },
  PubChiveReviewListForAuthor: {
    lexicon: 1,
    id: 'pub.chive.review.listForAuthor',
    defs: {
      main: {
        type: 'query',
        description: 'List reviews created by a specific author with optional filtering',
        parameters: {
          type: 'params',
          required: ['reviewerDid'],
          properties: {
            reviewerDid: {
              type: 'string',
              format: 'did',
              description: 'DID of the reviewer',
            },
            motivation: {
              type: 'string',
              knownValues: [
                'commenting',
                'highlighting',
                'questioning',
                'replying',
                'assessing',
                'bookmarking',
                'classifying',
                'describing',
                'editing',
                'linking',
                'moderating',
                'tagging',
              ],
              description: 'Filter by W3C Web Annotation motivation',
            },
            inlineOnly: {
              type: 'boolean',
              default: false,
              description: 'Only include inline annotations with text span targets',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Maximum number of results to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor for next page',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['reviews', 'hasMore'],
            properties: {
              reviews: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.review.listForAuthor#reviewView',
                },
                description: 'List of reviews by the author',
              },
              cursor: {
                type: 'string',
                description: 'Cursor for next page',
              },
              hasMore: {
                type: 'boolean',
                description: 'Whether more results are available',
              },
              total: {
                type: 'integer',
                description: 'Total number of reviews by this author',
              },
            },
          },
        },
        errors: [],
      },
      reviewView: {
        type: 'object',
        description: 'View of a review/comment',
        required: [
          'uri',
          'cid',
          'author',
          'eprintUri',
          'content',
          'motivation',
          'replyCount',
          'createdAt',
          'indexedAt',
        ],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'Review AT-URI',
          },
          cid: {
            type: 'string',
            description: 'Content identifier',
          },
          author: {
            type: 'ref',
            ref: 'lex:pub.chive.review.listForAuthor#authorRef',
          },
          eprintUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the eprint being reviewed',
          },
          content: {
            type: 'string',
            description: 'Plain text content of the review',
          },
          body: {
            type: 'ref',
            ref: 'lex:pub.chive.review.listForAuthor#annotationBody',
            description: 'Rich text body with facets',
          },
          target: {
            type: 'ref',
            ref: 'lex:pub.chive.review.listForAuthor#textSpanTarget',
            description: 'Target text span for inline annotations',
          },
          motivation: {
            type: 'string',
            knownValues: [
              'commenting',
              'highlighting',
              'questioning',
              'replying',
              'assessing',
              'bookmarking',
              'classifying',
              'describing',
              'editing',
              'linking',
              'moderating',
              'tagging',
            ],
            description: 'W3C Web Annotation motivation',
          },
          parentReviewUri: {
            type: 'string',
            format: 'at-uri',
            description: 'Parent review URI for threaded replies',
          },
          replyCount: {
            type: 'integer',
            minimum: 0,
            description: 'Number of direct replies',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the review was created',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the review was indexed',
          },
        },
      },
      authorRef: {
        type: 'object',
        required: ['did'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
          },
          avatar: {
            type: 'string',
            format: 'uri',
          },
        },
      },
      annotationBody: {
        type: 'object',
        description: 'Rich text body with optional facets',
        required: ['text'],
        properties: {
          text: {
            type: 'string',
            maxLength: 10000,
            description: 'Plain text content',
          },
          facets: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.review.listForAuthor#richTextFacet',
            },
            description: 'Rich text facets for mentions, links, and tags',
          },
        },
      },
      richTextFacet: {
        type: 'object',
        required: ['index', 'features'],
        properties: {
          index: {
            type: 'ref',
            ref: 'lex:pub.chive.review.listForAuthor#byteSlice',
          },
          features: {
            type: 'array',
            items: {
              type: 'union',
              refs: [
                'lex:pub.chive.review.listForAuthor#mentionFacet',
                'lex:pub.chive.review.listForAuthor#linkFacet',
                'lex:pub.chive.review.listForAuthor#tagFacet',
              ],
            },
          },
        },
      },
      byteSlice: {
        type: 'object',
        description: 'Byte slice for facet positioning',
        required: ['byteStart', 'byteEnd'],
        properties: {
          byteStart: {
            type: 'integer',
            minimum: 0,
          },
          byteEnd: {
            type: 'integer',
            minimum: 0,
          },
        },
      },
      mentionFacet: {
        type: 'object',
        required: ['did'],
        properties: {
          $type: {
            type: 'string',
            const: 'app.bsky.richtext.facet#mention',
          },
          did: {
            type: 'string',
            format: 'did',
          },
        },
      },
      linkFacet: {
        type: 'object',
        required: ['uri'],
        properties: {
          $type: {
            type: 'string',
            const: 'app.bsky.richtext.facet#link',
          },
          uri: {
            type: 'string',
            format: 'uri',
          },
        },
      },
      tagFacet: {
        type: 'object',
        required: ['tag'],
        properties: {
          $type: {
            type: 'string',
            const: 'app.bsky.richtext.facet#tag',
          },
          tag: {
            type: 'string',
          },
        },
      },
      textSpanTarget: {
        type: 'object',
        description: 'Target text span for inline annotations (W3C Web Annotation compatible)',
        required: ['source'],
        properties: {
          source: {
            type: 'string',
            format: 'at-uri',
            description: 'Eprint AT-URI',
          },
          selector: {
            type: 'ref',
            ref: 'lex:pub.chive.review.listForAuthor#textQuoteSelector',
            description: 'Text quote selector',
          },
          refinedBy: {
            type: 'ref',
            ref: 'lex:pub.chive.review.listForAuthor#textPositionSelector',
            description: 'Position refinement with page info',
          },
          page: {
            type: 'integer',
            minimum: 1,
            description: 'Page number (deprecated, use refinedBy.pageNumber)',
          },
        },
      },
      textQuoteSelector: {
        type: 'object',
        description: 'W3C Text Quote Selector',
        required: ['type', 'exact'],
        properties: {
          type: {
            type: 'string',
            const: 'TextQuoteSelector',
          },
          exact: {
            type: 'string',
            maxLength: 1000,
          },
          prefix: {
            type: 'string',
            maxLength: 100,
          },
          suffix: {
            type: 'string',
            maxLength: 100,
          },
        },
      },
      textPositionSelector: {
        type: 'object',
        description: 'W3C Text Position Selector with optional page info',
        required: ['type', 'start', 'end'],
        properties: {
          type: {
            type: 'string',
            const: 'TextPositionSelector',
          },
          start: {
            type: 'integer',
            minimum: 0,
          },
          end: {
            type: 'integer',
            minimum: 0,
          },
          pageNumber: {
            type: 'integer',
            minimum: 1,
            description: 'Page number in PDF',
          },
        },
      },
    },
  },
  PubChiveReviewListForEprint: {
    lexicon: 1,
    id: 'pub.chive.review.listForEprint',
    defs: {
      main: {
        type: 'query',
        description: 'List reviews for a specific eprint with optional filtering',
        parameters: {
          type: 'params',
          required: ['eprintUri'],
          properties: {
            eprintUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of the eprint',
            },
            motivation: {
              type: 'string',
              knownValues: [
                'commenting',
                'highlighting',
                'questioning',
                'replying',
                'assessing',
                'bookmarking',
                'classifying',
                'describing',
                'editing',
                'linking',
                'moderating',
                'tagging',
              ],
              description: 'Filter by W3C Web Annotation motivation',
            },
            inlineOnly: {
              type: 'boolean',
              default: false,
              description: 'Only include inline annotations with text span targets',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Maximum number of results to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor for next page',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['reviews', 'hasMore'],
            properties: {
              reviews: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.review.listForEprint#reviewView',
                },
                description: 'List of reviews for the eprint',
              },
              cursor: {
                type: 'string',
                description: 'Cursor for next page',
              },
              hasMore: {
                type: 'boolean',
                description: 'Whether more results are available',
              },
              total: {
                type: 'integer',
                description: 'Total number of reviews for this eprint',
              },
            },
          },
        },
        errors: [],
      },
      reviewView: {
        type: 'object',
        description: 'View of a review/comment',
        required: [
          'uri',
          'cid',
          'author',
          'eprintUri',
          'content',
          'motivation',
          'replyCount',
          'createdAt',
          'indexedAt',
        ],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'Review AT-URI',
          },
          cid: {
            type: 'string',
            description: 'Content identifier',
          },
          author: {
            type: 'ref',
            ref: 'lex:pub.chive.review.listForEprint#authorRef',
          },
          eprintUri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI of the eprint being reviewed',
          },
          content: {
            type: 'string',
            description: 'Plain text content of the review',
          },
          body: {
            type: 'ref',
            ref: 'lex:pub.chive.review.listForEprint#annotationBody',
            description: 'Rich text body with facets',
          },
          target: {
            type: 'ref',
            ref: 'lex:pub.chive.review.listForEprint#textSpanTarget',
            description: 'Target text span for inline annotations',
          },
          motivation: {
            type: 'string',
            knownValues: [
              'commenting',
              'highlighting',
              'questioning',
              'replying',
              'assessing',
              'bookmarking',
              'classifying',
              'describing',
              'editing',
              'linking',
              'moderating',
              'tagging',
            ],
            description: 'W3C Web Annotation motivation',
          },
          parentReviewUri: {
            type: 'string',
            format: 'at-uri',
            description: 'Parent review URI for threaded replies',
          },
          replyCount: {
            type: 'integer',
            minimum: 0,
            description: 'Number of direct replies',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the review was created',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
            description: 'When the review was indexed',
          },
        },
      },
      authorRef: {
        type: 'object',
        required: ['did'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
          },
          avatar: {
            type: 'string',
            format: 'uri',
          },
        },
      },
      annotationBody: {
        type: 'object',
        description: 'Rich text body with optional facets',
        required: ['text'],
        properties: {
          text: {
            type: 'string',
            maxLength: 10000,
            description: 'Plain text content',
          },
          facets: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:pub.chive.review.listForEprint#richTextFacet',
            },
            description: 'Rich text facets for mentions, links, and tags',
          },
        },
      },
      richTextFacet: {
        type: 'object',
        required: ['index', 'features'],
        properties: {
          index: {
            type: 'ref',
            ref: 'lex:pub.chive.review.listForEprint#byteSlice',
          },
          features: {
            type: 'array',
            items: {
              type: 'union',
              refs: [
                'lex:pub.chive.review.listForEprint#mentionFacet',
                'lex:pub.chive.review.listForEprint#linkFacet',
                'lex:pub.chive.review.listForEprint#tagFacet',
              ],
            },
          },
        },
      },
      byteSlice: {
        type: 'object',
        description: 'Byte slice for facet positioning',
        required: ['byteStart', 'byteEnd'],
        properties: {
          byteStart: {
            type: 'integer',
            minimum: 0,
          },
          byteEnd: {
            type: 'integer',
            minimum: 0,
          },
        },
      },
      mentionFacet: {
        type: 'object',
        required: ['did'],
        properties: {
          $type: {
            type: 'string',
            const: 'app.bsky.richtext.facet#mention',
          },
          did: {
            type: 'string',
            format: 'did',
          },
        },
      },
      linkFacet: {
        type: 'object',
        required: ['uri'],
        properties: {
          $type: {
            type: 'string',
            const: 'app.bsky.richtext.facet#link',
          },
          uri: {
            type: 'string',
            format: 'uri',
          },
        },
      },
      tagFacet: {
        type: 'object',
        required: ['tag'],
        properties: {
          $type: {
            type: 'string',
            const: 'app.bsky.richtext.facet#tag',
          },
          tag: {
            type: 'string',
          },
        },
      },
      textSpanTarget: {
        type: 'object',
        description: 'Target text span for inline annotations (W3C Web Annotation compatible)',
        required: ['source'],
        properties: {
          source: {
            type: 'string',
            format: 'at-uri',
            description: 'Eprint AT-URI',
          },
          selector: {
            type: 'ref',
            ref: 'lex:pub.chive.review.listForEprint#textQuoteSelector',
            description: 'Text quote selector',
          },
          refinedBy: {
            type: 'ref',
            ref: 'lex:pub.chive.review.listForEprint#textPositionSelector',
            description: 'Position refinement with page info',
          },
          page: {
            type: 'integer',
            minimum: 1,
            description: 'Page number (deprecated, use refinedBy.pageNumber)',
          },
        },
      },
      textQuoteSelector: {
        type: 'object',
        description: 'W3C Text Quote Selector',
        required: ['type', 'exact'],
        properties: {
          type: {
            type: 'string',
            const: 'TextQuoteSelector',
          },
          exact: {
            type: 'string',
            maxLength: 1000,
          },
          prefix: {
            type: 'string',
            maxLength: 100,
          },
          suffix: {
            type: 'string',
            maxLength: 100,
          },
        },
      },
      textPositionSelector: {
        type: 'object',
        description: 'W3C Text Position Selector with optional page info',
        required: ['type', 'start', 'end'],
        properties: {
          type: {
            type: 'string',
            const: 'TextPositionSelector',
          },
          start: {
            type: 'integer',
            minimum: 0,
          },
          end: {
            type: 'integer',
            minimum: 0,
          },
          pageNumber: {
            type: 'integer',
            minimum: 1,
            description: 'Page number in PDF',
          },
        },
      },
    },
  },
  PubChiveSyncCheckStaleness: {
    lexicon: 1,
    id: 'pub.chive.sync.checkStaleness',
    defs: {
      main: {
        type: 'query',
        description: 'Check if indexed data is stale compared to PDS',
        parameters: {
          type: 'params',
          required: ['uri'],
          properties: {
            uri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of the record to check',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['uri', 'isStale'],
            properties: {
              uri: {
                type: 'string',
                format: 'at-uri',
              },
              isStale: {
                type: 'boolean',
                description: 'Whether indexed data is stale',
              },
              indexedAt: {
                type: 'string',
                format: 'datetime',
                description: 'When the record was indexed',
              },
              indexedCid: {
                type: 'string',
                format: 'cid',
                description: 'CID in our index',
              },
              pdsCid: {
                type: 'string',
                format: 'cid',
                description: 'Current CID on PDS',
              },
              pdsUrl: {
                type: 'string',
                description: 'Source PDS URL',
              },
            },
          },
        },
        errors: [
          {
            name: 'NotFound',
          },
        ],
      },
    },
  },
  PubChiveSyncIndexRecord: {
    lexicon: 1,
    id: 'pub.chive.sync.indexRecord',
    defs: {
      main: {
        type: 'procedure',
        description: 'Index a record from PDS (owner or admin only)',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['uri'],
            properties: {
              uri: {
                type: 'string',
                format: 'at-uri',
                description: 'AT-URI of the record to index',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['uri', 'indexed'],
            properties: {
              uri: {
                type: 'string',
                format: 'at-uri',
                description: 'AT-URI of the indexed record',
              },
              indexed: {
                type: 'boolean',
                description: 'Whether indexing succeeded',
              },
              cid: {
                type: 'string',
                format: 'cid',
                description: 'CID of the indexed record (if successful)',
              },
              error: {
                type: 'string',
                description: 'Error message (if failed)',
              },
            },
          },
        },
        errors: [
          {
            name: 'InvalidRequest',
          },
          {
            name: 'AuthenticationRequired',
          },
          {
            name: 'NotFound',
          },
        ],
      },
    },
  },
  PubChiveSyncRefreshRecord: {
    lexicon: 1,
    id: 'pub.chive.sync.refreshRecord',
    defs: {
      main: {
        type: 'procedure',
        description: 'Refresh a stale record from PDS',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['uri'],
            properties: {
              uri: {
                type: 'string',
                format: 'at-uri',
                description: 'AT-URI of the record to refresh',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['uri', 'refreshed'],
            properties: {
              uri: {
                type: 'string',
                format: 'at-uri',
              },
              refreshed: {
                type: 'boolean',
                description: 'Whether refresh succeeded',
              },
              newCid: {
                type: 'string',
                format: 'cid',
                description: 'New CID after refresh',
              },
              error: {
                type: 'string',
                description: 'Error message if refresh failed',
              },
            },
          },
        },
        errors: [
          {
            name: 'NotFound',
          },
          {
            name: 'AuthenticationRequired',
          },
        ],
      },
    },
  },
  PubChiveSyncRegisterPDS: {
    lexicon: 1,
    id: 'pub.chive.sync.registerPDS',
    defs: {
      main: {
        type: 'procedure',
        description:
          'Register a PDS for scanning to ensure records from non-relay PDSes can be discovered and indexed',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['pdsUrl'],
            properties: {
              pdsUrl: {
                type: 'string',
                format: 'uri',
                description: 'PDS endpoint URL to register',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['pdsUrl', 'registered', 'status'],
            properties: {
              pdsUrl: {
                type: 'string',
                format: 'uri',
                description: 'The registered PDS URL',
              },
              registered: {
                type: 'boolean',
                description: 'Whether the PDS was registered',
              },
              status: {
                type: 'string',
                knownValues: ['pending', 'already_exists', 'scanned'],
                description: 'Registration status',
              },
              message: {
                type: 'string',
                description: 'Human-readable status message',
              },
            },
          },
        },
        errors: [
          {
            name: 'InvalidRequest',
          },
          {
            name: 'ServiceUnavailable',
          },
        ],
      },
    },
  },
  PubChiveSyncVerify: {
    lexicon: 1,
    id: 'pub.chive.sync.verify',
    defs: {
      main: {
        type: 'query',
        description: 'Verify the sync state of a record',
        parameters: {
          type: 'params',
          required: ['uri'],
          properties: {
            uri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of the record to verify',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['uri', 'indexed', 'inSync'],
            properties: {
              uri: {
                type: 'string',
                format: 'at-uri',
                description: 'AT-URI of the record',
              },
              indexed: {
                type: 'boolean',
                description: 'Whether the record is indexed',
              },
              inSync: {
                type: 'boolean',
                description: 'Whether the indexed record is in sync with the PDS',
              },
              indexedAt: {
                type: 'string',
                format: 'datetime',
                description: 'When the record was indexed',
              },
              lastSyncedAt: {
                type: 'string',
                format: 'datetime',
                description: 'When the record was last synced',
              },
              staleDays: {
                type: 'integer',
                description: 'Number of days since last sync if stale',
              },
            },
          },
        },
        errors: [
          {
            name: 'InvalidRequest',
          },
        ],
      },
    },
  },
  PubChiveTagGetDetail: {
    lexicon: 1,
    id: 'pub.chive.tag.getDetail',
    defs: {
      main: {
        type: 'query',
        description: 'Get detailed information for a specific tag',
        parameters: {
          type: 'params',
          required: ['tag'],
          properties: {
            tag: {
              type: 'string',
              description: 'Normalized tag form to look up',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:pub.chive.tag.getDetail#tagSummary',
          },
        },
        errors: [
          {
            name: 'TagNotFound',
          },
        ],
      },
      tagSummary: {
        type: 'object',
        description: 'Summary information for a tag',
        required: ['normalizedForm', 'displayForms', 'usageCount', 'qualityScore', 'isPromoted'],
        properties: {
          normalizedForm: {
            type: 'string',
            description: 'Normalized tag form (lowercase, hyphenated)',
          },
          displayForms: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'All display forms used for this tag',
          },
          usageCount: {
            type: 'integer',
            minimum: 0,
            description: 'Number of eprints tagged with this tag',
          },
          qualityScore: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description: 'Tag quality score (0-100, scaled from 0-1)',
          },
          isPromoted: {
            type: 'boolean',
            description: 'Whether the tag has been promoted to a facet or authority',
          },
          promotedTo: {
            type: 'ref',
            ref: 'lex:pub.chive.tag.getDetail#promotionTarget',
            description: 'Promotion target if promoted',
          },
        },
      },
      promotionTarget: {
        type: 'object',
        description: 'Target of tag promotion',
        required: ['type', 'uri'],
        properties: {
          type: {
            type: 'string',
            knownValues: ['facet', 'authority'],
            description: 'Type of promotion target',
          },
          uri: {
            type: 'string',
            description: 'URI of the promotion target',
          },
        },
      },
    },
  },
  PubChiveTagGetSuggestions: {
    lexicon: 1,
    id: 'pub.chive.tag.getSuggestions',
    defs: {
      main: {
        type: 'query',
        description: 'Get tag suggestions based on a query using the TaxoFolk system',
        parameters: {
          type: 'params',
          required: ['q'],
          properties: {
            q: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              description: 'Query string to get suggestions for',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 20,
              default: 10,
              description: 'Maximum number of suggestions to return',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['suggestions'],
            properties: {
              suggestions: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.tag.getSuggestions#tagSuggestion',
                },
                description: 'List of tag suggestions',
              },
            },
          },
        },
        errors: [],
      },
      tagSuggestion: {
        type: 'object',
        description: 'A tag suggestion from the TaxoFolk system',
        required: ['displayForm', 'normalizedForm', 'confidence', 'source'],
        properties: {
          displayForm: {
            type: 'string',
            description: 'Suggested display form',
          },
          normalizedForm: {
            type: 'string',
            description: 'Normalized form of the suggestion',
          },
          confidence: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description: 'Suggestion confidence (0-100, scaled from 0-1)',
          },
          source: {
            type: 'string',
            knownValues: ['cooccurrence', 'authority', 'facet'],
            description: 'Source of the suggestion',
          },
          matchedTerm: {
            type: 'string',
            description: 'Term that triggered this suggestion',
          },
        },
      },
    },
  },
  PubChiveTagGetTrending: {
    lexicon: 1,
    id: 'pub.chive.tag.getTrending',
    defs: {
      main: {
        type: 'query',
        description: 'Get trending tags within a specified time window',
        parameters: {
          type: 'params',
          required: [],
          properties: {
            timeWindow: {
              type: 'string',
              knownValues: ['day', 'week', 'month'],
              default: 'week',
              description: 'Time window for trending calculation',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 50,
              default: 20,
              description: 'Maximum number of trending tags to return',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['tags', 'timeWindow'],
            properties: {
              tags: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.tag.getTrending#tagSummary',
                },
                description: 'List of trending tags',
              },
              timeWindow: {
                type: 'string',
                knownValues: ['day', 'week', 'month'],
                description: 'Time window used for this response',
              },
            },
          },
        },
        errors: [],
      },
      tagSummary: {
        type: 'object',
        description: 'Summary information for a tag',
        required: ['normalizedForm', 'displayForms', 'usageCount', 'qualityScore', 'isPromoted'],
        properties: {
          normalizedForm: {
            type: 'string',
            description: 'Normalized tag form (lowercase, hyphenated)',
          },
          displayForms: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'All display forms used for this tag',
          },
          usageCount: {
            type: 'integer',
            minimum: 0,
            description: 'Number of eprints tagged with this tag',
          },
          qualityScore: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description: 'Tag quality score (0-100, scaled from 0-1)',
          },
          isPromoted: {
            type: 'boolean',
            description: 'Whether the tag has been promoted to a facet or authority',
          },
          promotedTo: {
            type: 'ref',
            ref: 'lex:pub.chive.tag.getTrending#promotionTarget',
            description: 'Promotion target if promoted',
          },
        },
      },
      promotionTarget: {
        type: 'object',
        description: 'Target of tag promotion',
        required: ['type', 'uri'],
        properties: {
          type: {
            type: 'string',
            knownValues: ['facet', 'authority'],
            description: 'Type of promotion target',
          },
          uri: {
            type: 'string',
            description: 'URI of the promotion target',
          },
        },
      },
    },
  },
  PubChiveTagListForEprint: {
    lexicon: 1,
    id: 'pub.chive.tag.listForEprint',
    defs: {
      main: {
        type: 'query',
        description: 'List tags for a specific eprint with TaxoFolk suggestions',
        parameters: {
          type: 'params',
          required: ['eprintUri'],
          properties: {
            eprintUri: {
              type: 'string',
              format: 'at-uri',
              description: 'AT-URI of the eprint to list tags for',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['tags'],
            properties: {
              tags: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.tag.listForEprint#userTag',
                },
                description: 'Tags applied to the eprint',
              },
              suggestions: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.tag.listForEprint#tagSuggestion',
                },
                description: 'TaxoFolk suggestions based on existing tags',
              },
            },
          },
        },
        errors: [],
      },
      userTag: {
        type: 'object',
        description: 'A user-applied tag on an eprint',
        required: [
          'uri',
          'cid',
          'eprintUri',
          'author',
          'displayForm',
          'normalizedForm',
          'createdAt',
        ],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'Tag AT-URI',
          },
          cid: {
            type: 'string',
            description: 'Content identifier',
          },
          eprintUri: {
            type: 'string',
            format: 'at-uri',
            description: 'Tagged eprint AT-URI',
          },
          author: {
            type: 'ref',
            ref: 'lex:pub.chive.tag.listForEprint#authorRef',
            description: 'Tag creator',
          },
          displayForm: {
            type: 'string',
            description: 'Original display form of the tag',
          },
          normalizedForm: {
            type: 'string',
            description: 'Normalized form (lowercase, hyphenated)',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
            description: 'Creation timestamp',
          },
        },
      },
      authorRef: {
        type: 'object',
        description: 'Reference to an author',
        required: ['did'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
            description: 'Author DID',
          },
          handle: {
            type: 'string',
            description: 'Author handle',
          },
          displayName: {
            type: 'string',
            description: 'Display name',
          },
          avatar: {
            type: 'string',
            format: 'uri',
            description: 'Avatar URL',
          },
        },
      },
      tagSuggestion: {
        type: 'object',
        description: 'A tag suggestion from the TaxoFolk system',
        required: ['displayForm', 'normalizedForm', 'confidence', 'source'],
        properties: {
          displayForm: {
            type: 'string',
            description: 'Suggested display form',
          },
          normalizedForm: {
            type: 'string',
            description: 'Normalized form of the suggestion',
          },
          confidence: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description: 'Suggestion confidence (0-100, scaled from 0-1)',
          },
          source: {
            type: 'string',
            knownValues: ['cooccurrence', 'authority', 'facet'],
            description: 'Source of the suggestion',
          },
          matchedTerm: {
            type: 'string',
            description: 'Term that triggered this suggestion',
          },
        },
      },
    },
  },
  PubChiveTagSearch: {
    lexicon: 1,
    id: 'pub.chive.tag.search',
    defs: {
      main: {
        type: 'query',
        description: 'Search for tags matching a query',
        parameters: {
          type: 'params',
          required: ['q'],
          properties: {
            q: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              description: 'Search query',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Maximum number of results to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor for next page',
            },
            minQuality: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              description: 'Minimum quality score (0-100, scaled from 0-1)',
            },
            includeSpam: {
              type: 'boolean',
              default: false,
              description: 'Include tags flagged as potential spam',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['tags', 'hasMore'],
            properties: {
              tags: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:pub.chive.tag.search#tagSummary',
                },
                description: 'Search results',
              },
              cursor: {
                type: 'string',
                description: 'Cursor for next page',
              },
              hasMore: {
                type: 'boolean',
                description: 'Whether more results are available',
              },
              total: {
                type: 'integer',
                minimum: 0,
                description: 'Total count of matching tags',
              },
            },
          },
        },
        errors: [],
      },
      tagSummary: {
        type: 'object',
        description: 'Summary information for a tag',
        required: ['normalizedForm', 'displayForms', 'usageCount', 'qualityScore', 'isPromoted'],
        properties: {
          normalizedForm: {
            type: 'string',
            description: 'Normalized tag form (lowercase, hyphenated)',
          },
          displayForms: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'All display forms used for this tag',
          },
          usageCount: {
            type: 'integer',
            minimum: 0,
            description: 'Number of eprints tagged with this tag',
          },
          qualityScore: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description: 'Tag quality score (0-100, scaled from 0-1)',
          },
          isPromoted: {
            type: 'boolean',
            description: 'Whether the tag has been promoted to a facet or authority',
          },
          promotedTo: {
            type: 'ref',
            ref: 'lex:pub.chive.tag.search#promotionTarget',
            description: 'Promotion target if promoted',
          },
        },
      },
      promotionTarget: {
        type: 'object',
        description: 'Target of tag promotion',
        required: ['type', 'uri'],
        properties: {
          type: {
            type: 'string',
            knownValues: ['facet', 'authority'],
            description: 'Type of promotion target',
          },
          uri: {
            type: 'string',
            description: 'URI of the promotion target',
          },
        },
      },
    },
  },
} as const satisfies Record<string, LexiconDoc>;
export const schemas = Object.values(schemaDict) satisfies LexiconDoc[];
export const lexicons: Lexicons = new Lexicons(schemas);

export function validate<T extends { $type: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType: true
): ValidationResult<T>;
export function validate<T extends { $type?: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: false
): ValidationResult<T>;
export function validate(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: boolean
): ValidationResult {
  return (requiredType ? is$typed : maybe$typed)(v, id, hash)
    ? lexicons.validate(`${id}#${hash}`, v)
    : {
        success: false,
        error: new ValidationError(
          `Must be an object with "${hash === 'main' ? id : `${id}#${hash}`}" $type property`
        ),
      };
}

export const ids = {
  ComAtprotoRepoApplyWrites: 'com.atproto.repo.applyWrites',
  ComAtprotoRepoCreateRecord: 'com.atproto.repo.createRecord',
  ComAtprotoRepoDefs: 'com.atproto.repo.defs',
  ComAtprotoRepoDeleteRecord: 'com.atproto.repo.deleteRecord',
  ComAtprotoRepoDescribeRepo: 'com.atproto.repo.describeRepo',
  ComAtprotoRepoGetRecord: 'com.atproto.repo.getRecord',
  ComAtprotoRepoImportRepo: 'com.atproto.repo.importRepo',
  ComAtprotoRepoListMissingBlobs: 'com.atproto.repo.listMissingBlobs',
  ComAtprotoRepoListRecords: 'com.atproto.repo.listRecords',
  ComAtprotoRepoPutRecord: 'com.atproto.repo.putRecord',
  ComAtprotoRepoStrongRef: 'com.atproto.repo.strongRef',
  ComAtprotoRepoUploadBlob: 'com.atproto.repo.uploadBlob',
  PubChiveActivityGetCorrelationMetrics: 'pub.chive.activity.getCorrelationMetrics',
  PubChiveActivityGetFeed: 'pub.chive.activity.getFeed',
  PubChiveActivityLog: 'pub.chive.activity.log',
  PubChiveActivityMarkFailed: 'pub.chive.activity.markFailed',
  PubChiveActorAutocompleteAffiliation: 'pub.chive.actor.autocompleteAffiliation',
  PubChiveActorAutocompleteKeyword: 'pub.chive.actor.autocompleteKeyword',
  PubChiveActorAutocompleteOpenReview: 'pub.chive.actor.autocompleteOpenReview',
  PubChiveActorAutocompleteOrcid: 'pub.chive.actor.autocompleteOrcid',
  PubChiveActorDiscoverAuthorIds: 'pub.chive.actor.discoverAuthorIds',
  PubChiveActorGetDiscoverySettings: 'pub.chive.actor.getDiscoverySettings',
  PubChiveActorGetMyProfile: 'pub.chive.actor.getMyProfile',
  PubChiveActorProfile: 'pub.chive.actor.profile',
  PubChiveAlphaApply: 'pub.chive.alpha.apply',
  PubChiveAlphaCheckStatus: 'pub.chive.alpha.checkStatus',
  PubChiveAuthorGetProfile: 'pub.chive.author.getProfile',
  PubChiveAuthorSearchAuthors: 'pub.chive.author.searchAuthors',
  PubChiveBacklinkCreate: 'pub.chive.backlink.create',
  PubChiveBacklinkDelete: 'pub.chive.backlink.delete',
  PubChiveBacklinkGetCounts: 'pub.chive.backlink.getCounts',
  PubChiveBacklinkList: 'pub.chive.backlink.list',
  PubChiveClaimingApproveClaim: 'pub.chive.claiming.approveClaim',
  PubChiveClaimingApproveCoauthor: 'pub.chive.claiming.approveCoauthor',
  PubChiveClaimingAutocomplete: 'pub.chive.claiming.autocomplete',
  PubChiveClaimingCompleteClaim: 'pub.chive.claiming.completeClaim',
  PubChiveClaimingFetchExternalPdf: 'pub.chive.claiming.fetchExternalPdf',
  PubChiveClaimingFindClaimable: 'pub.chive.claiming.findClaimable',
  PubChiveClaimingGetClaim: 'pub.chive.claiming.getClaim',
  PubChiveClaimingGetCoauthorRequests: 'pub.chive.claiming.getCoauthorRequests',
  PubChiveClaimingGetMyCoauthorRequests: 'pub.chive.claiming.getMyCoauthorRequests',
  PubChiveClaimingGetPendingClaims: 'pub.chive.claiming.getPendingClaims',
  PubChiveClaimingGetSubmissionData: 'pub.chive.claiming.getSubmissionData',
  PubChiveClaimingGetSuggestions: 'pub.chive.claiming.getSuggestions',
  PubChiveClaimingGetUserClaims: 'pub.chive.claiming.getUserClaims',
  PubChiveClaimingRejectClaim: 'pub.chive.claiming.rejectClaim',
  PubChiveClaimingRejectCoauthor: 'pub.chive.claiming.rejectCoauthor',
  PubChiveClaimingRequestCoauthorship: 'pub.chive.claiming.requestCoauthorship',
  PubChiveClaimingSearchEprints: 'pub.chive.claiming.searchEprints',
  PubChiveClaimingStartClaim: 'pub.chive.claiming.startClaim',
  PubChiveClaimingStartClaimFromExternal: 'pub.chive.claiming.startClaimFromExternal',
  PubChiveDiscoveryGetCitations: 'pub.chive.discovery.getCitations',
  PubChiveDiscoveryGetEnrichment: 'pub.chive.discovery.getEnrichment',
  PubChiveDiscoveryGetForYou: 'pub.chive.discovery.getForYou',
  PubChiveDiscoveryGetRecommendations: 'pub.chive.discovery.getRecommendations',
  PubChiveDiscoveryGetSimilar: 'pub.chive.discovery.getSimilar',
  PubChiveDiscoveryRecordInteraction: 'pub.chive.discovery.recordInteraction',
  PubChiveDiscoverySettings: 'pub.chive.discovery.settings',
  PubChiveEndorsementGetSummary: 'pub.chive.endorsement.getSummary',
  PubChiveEndorsementGetUserEndorsement: 'pub.chive.endorsement.getUserEndorsement',
  PubChiveEndorsementListForEprint: 'pub.chive.endorsement.listForEprint',
  PubChiveEprintAuthorContribution: 'pub.chive.eprint.authorContribution',
  PubChiveEprintGetSubmission: 'pub.chive.eprint.getSubmission',
  PubChiveEprintListByAuthor: 'pub.chive.eprint.listByAuthor',
  PubChiveEprintSearchSubmissions: 'pub.chive.eprint.searchSubmissions',
  PubChiveEprintSubmission: 'pub.chive.eprint.submission',
  PubChiveEprintUserTag: 'pub.chive.eprint.userTag',
  PubChiveEprintVersion: 'pub.chive.eprint.version',
  PubChiveGovernanceApproveElevation: 'pub.chive.governance.approveElevation',
  PubChiveGovernanceGetEditorStatus: 'pub.chive.governance.getEditorStatus',
  PubChiveGovernanceGetPendingCount: 'pub.chive.governance.getPendingCount',
  PubChiveGovernanceGetProposal: 'pub.chive.governance.getProposal',
  PubChiveGovernanceGetUserVote: 'pub.chive.governance.getUserVote',
  PubChiveGovernanceGrantDelegation: 'pub.chive.governance.grantDelegation',
  PubChiveGovernanceListDelegations: 'pub.chive.governance.listDelegations',
  PubChiveGovernanceListElevationRequests: 'pub.chive.governance.listElevationRequests',
  PubChiveGovernanceListProposals: 'pub.chive.governance.listProposals',
  PubChiveGovernanceListTrustedEditors: 'pub.chive.governance.listTrustedEditors',
  PubChiveGovernanceListVotes: 'pub.chive.governance.listVotes',
  PubChiveGovernanceRejectElevation: 'pub.chive.governance.rejectElevation',
  PubChiveGovernanceRequestElevation: 'pub.chive.governance.requestElevation',
  PubChiveGovernanceRevokeDelegation: 'pub.chive.governance.revokeDelegation',
  PubChiveGovernanceRevokeRole: 'pub.chive.governance.revokeRole',
  PubChiveGraphBrowseFaceted: 'pub.chive.graph.browseFaceted',
  PubChiveGraphEdge: 'pub.chive.graph.edge',
  PubChiveGraphEdgeProposal: 'pub.chive.graph.edgeProposal',
  PubChiveGraphGetCommunities: 'pub.chive.graph.getCommunities',
  PubChiveGraphGetEdge: 'pub.chive.graph.getEdge',
  PubChiveGraphGetHierarchy: 'pub.chive.graph.getHierarchy',
  PubChiveGraphGetNode: 'pub.chive.graph.getNode',
  PubChiveGraphGetRelations: 'pub.chive.graph.getRelations',
  PubChiveGraphGetSubkinds: 'pub.chive.graph.getSubkinds',
  PubChiveGraphListEdges: 'pub.chive.graph.listEdges',
  PubChiveGraphListNodes: 'pub.chive.graph.listNodes',
  PubChiveGraphNode: 'pub.chive.graph.node',
  PubChiveGraphNodeProposal: 'pub.chive.graph.nodeProposal',
  PubChiveGraphReconciliation: 'pub.chive.graph.reconciliation',
  PubChiveGraphSearchNodes: 'pub.chive.graph.searchNodes',
  PubChiveGraphVote: 'pub.chive.graph.vote',
  PubChiveImportExists: 'pub.chive.import.exists',
  PubChiveImportGet: 'pub.chive.import.get',
  PubChiveImportSearch: 'pub.chive.import.search',
  PubChiveMetricsGetMetrics: 'pub.chive.metrics.getMetrics',
  PubChiveMetricsGetTrending: 'pub.chive.metrics.getTrending',
  PubChiveMetricsGetViewCount: 'pub.chive.metrics.getViewCount',
  PubChiveMetricsRecordDownload: 'pub.chive.metrics.recordDownload',
  PubChiveMetricsRecordDwellTime: 'pub.chive.metrics.recordDwellTime',
  PubChiveMetricsRecordSearchClick: 'pub.chive.metrics.recordSearchClick',
  PubChiveMetricsRecordSearchDownload: 'pub.chive.metrics.recordSearchDownload',
  PubChiveMetricsRecordView: 'pub.chive.metrics.recordView',
  PubChiveNotificationListEndorsementsOnMyPapers:
    'pub.chive.notification.listEndorsementsOnMyPapers',
  PubChiveNotificationListReviewsOnMyPapers: 'pub.chive.notification.listReviewsOnMyPapers',
  PubChiveReviewComment: 'pub.chive.review.comment',
  PubChiveReviewEndorsement: 'pub.chive.review.endorsement',
  PubChiveReviewEntityLink: 'pub.chive.review.entityLink',
  PubChiveReviewGetThread: 'pub.chive.review.getThread',
  PubChiveReviewListForAuthor: 'pub.chive.review.listForAuthor',
  PubChiveReviewListForEprint: 'pub.chive.review.listForEprint',
  PubChiveSyncCheckStaleness: 'pub.chive.sync.checkStaleness',
  PubChiveSyncIndexRecord: 'pub.chive.sync.indexRecord',
  PubChiveSyncRefreshRecord: 'pub.chive.sync.refreshRecord',
  PubChiveSyncRegisterPDS: 'pub.chive.sync.registerPDS',
  PubChiveSyncVerify: 'pub.chive.sync.verify',
  PubChiveTagGetDetail: 'pub.chive.tag.getDetail',
  PubChiveTagGetSuggestions: 'pub.chive.tag.getSuggestions',
  PubChiveTagGetTrending: 'pub.chive.tag.getTrending',
  PubChiveTagListForEprint: 'pub.chive.tag.listForEprint',
  PubChiveTagSearch: 'pub.chive.tag.search',
} as const;
