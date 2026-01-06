/**
 * Barrel export for all Chive types.
 *
 * @remarks
 * This module exports all type definitions used throughout Chive:
 * - AT Protocol primitives (AtUri, DID, NSID, CID, BlobRef)
 * - Service interfaces (IRepository, ISearchEngine, IStorageBackend, etc.)
 * - Domain models (Preprint, Review, Author)
 * - Plugin system interfaces (IChivePlugin, IPluginContext, etc.)
 * - Error types (ChiveError, ComplianceError, etc.)
 * - Result monad (Result, Ok, Err, etc.)
 * - Validation types
 *
 * @packageDocumentation
 * @public
 */

// AT Protocol primitives
export * from './atproto.js';
export * from './atproto-validators.js';

// Error handling
export * from './errors.js';
export * from './result.js';
export * from './validation.js';

// Service interfaces
export * from './interfaces/index.js';

// Domain models
export * from './models/index.js';
