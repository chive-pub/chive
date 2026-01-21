/**
 * XRPC utility functions.
 *
 * @remarks
 * Provides query parameter decoding and other utilities for XRPC handling.
 * These utilities follow ATProto conventions for parameter parsing.
 *
 * @packageDocumentation
 * @public
 */

import type { LexXrpcQuery, LexXrpcProcedure } from '@atproto/lexicon';

/**
 * Parameter property definition type.
 */
interface ParamPropertyDef {
  type: string;
  items?: ParamPropertyDef;
}

/**
 * Decodes a single query parameter value based on lexicon type.
 *
 * @param def - Lexicon property definition
 * @param val - Raw string value from query string
 * @returns Decoded value with correct type
 *
 * @remarks
 * ATProto query parameters are always strings in the URL but may represent
 * different types (integer, boolean, array). This function converts them
 * based on the lexicon schema.
 */
export function decodeQueryParam(
  def: ParamPropertyDef | undefined,
  val: string | string[] | undefined
): unknown {
  if (val === undefined) {
    return undefined;
  }

  if (!def) {
    return val;
  }

  const type = def.type;

  switch (type) {
    case 'integer': {
      if (Array.isArray(val)) {
        return val.map((v) => {
          const num = parseInt(v, 10);
          return isNaN(num) ? v : num;
        });
      }
      const intVal = parseInt(val, 10);
      return isNaN(intVal) ? val : intVal;
    }

    case 'boolean':
      if (Array.isArray(val)) {
        return val.map((v) => v === 'true');
      }
      return val === 'true';

    case 'array': {
      // Ensure arrays are always arrays
      if (Array.isArray(val)) {
        // Recursively decode array items
        const itemDef = def.items;
        return val.map((v) => decodeQueryParam(itemDef, v));
      }
      // Single value becomes array
      const itemDefSingle = def.items;
      return [decodeQueryParam(itemDefSingle, val)];
    }

    case 'string':
    default:
      return val;
  }
}

/**
 * Decodes all query parameters based on lexicon definition.
 *
 * @param def - Lexicon query or procedure definition
 * @param rawParams - Raw query parameters from request
 * @returns Decoded parameters object
 *
 * @example
 * ```typescript
 * const lexDef = lexicons.getDef('pub.chive.eprint.getSubmission');
 * const params = decodeQueryParams(lexDef, c.req.query());
 * // { uri: 'at://...', limit: 50 }
 * ```
 */
export function decodeQueryParams(
  def: LexXrpcQuery | LexXrpcProcedure | undefined,
  rawParams: Record<string, string | string[] | undefined>
): Record<string, unknown> {
  if (!def?.parameters) {
    return rawParams;
  }

  const paramsDef = def.parameters;
  const properties =
    'properties' in paramsDef ? (paramsDef.properties as Record<string, ParamPropertyDef>) : {};
  const decoded: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rawParams)) {
    const propDef = properties?.[key];
    decoded[key] = decodeQueryParam(propDef, value);
  }

  return decoded;
}

/**
 * Normalizes an NSID to a route path.
 *
 * @param nsid - Namespace identifier (e.g., 'pub.chive.eprint.getSubmission')
 * @returns URL path segment
 */
export function nsidToPath(nsid: string): string {
  return `/${nsid}`;
}

/**
 * Extracts the NSID from a request path.
 *
 * @param path - Request path (e.g., '/xrpc/pub.chive.eprint.getSubmission')
 * @returns NSID or undefined
 */
export function pathToNsid(path: string): string | undefined {
  const match = /\/xrpc\/(.+)$/.exec(path);
  return match?.[1];
}

/**
 * Checks if a lexicon definition is a query (GET) or procedure (POST).
 *
 * @param def - Lexicon definition
 * @returns true if query, false if procedure
 */
export function isQuery(def: LexXrpcQuery | LexXrpcProcedure): boolean {
  return def.type === 'query';
}
