/**
 * XRPC validation utilities using generated lexicons.
 *
 * @remarks
 * Provides lexicon-based validation for XRPC parameters, input, and output.
 * Uses the ATProto-generated lexicons from @atproto/lex-cli.
 *
 * @packageDocumentation
 * @public
 */

import { ValidationError as LexiconValidationError } from '@atproto/lexicon';
import { InvalidRequestError, InternalServerError } from '@atproto/xrpc-server';

// Import the pre-built Lexicons instance from generated code
import { lexicons, ids } from '../../lexicons/generated/lexicons.js';

// Re-export for convenience
export { lexicons, ids };

/**
 * Validates XRPC parameters against a lexicon schema.
 *
 * @param lexiconsOrNsid - Lexicons instance or NSID of the method
 * @param nsidOrParams - NSID or parameters to validate
 * @param maybeParams - Parameters when using 3-arg form
 * @throws InvalidRequestError if validation fails
 *
 * @example
 * ```typescript
 * // 2-arg form (uses global lexicons)
 * validateXrpcParams('pub.chive.eprint.getSubmission', { uri: 'at://...' });
 *
 * // 3-arg form (uses provided lexicons)
 * validateXrpcParams(lexicons, 'pub.chive.eprint.getSubmission', { uri: 'at://...' });
 * ```
 */
export function validateXrpcParams(
  lexiconsOrNsid: typeof lexicons | string,
  nsidOrParams: string | Record<string, unknown>,
  maybeParams?: Record<string, unknown>
): void {
  // Determine which form is being used
  const lex = typeof lexiconsOrNsid === 'string' ? lexicons : lexiconsOrNsid;
  const nsid = typeof lexiconsOrNsid === 'string' ? lexiconsOrNsid : (nsidOrParams as string);
  const params =
    typeof lexiconsOrNsid === 'string'
      ? (nsidOrParams as Record<string, unknown>)
      : (maybeParams ?? {});

  try {
    lex.assertValidXrpcParams(nsid, params);
  } catch (err) {
    if (err instanceof LexiconValidationError) {
      throw new InvalidRequestError(err.message);
    }
    throw err;
  }
}

/**
 * Validates XRPC input (request body) against a lexicon schema.
 *
 * @param lexiconsOrNsid - Lexicons instance or NSID of the method
 * @param nsidOrInput - NSID or input body to validate
 * @param maybeInput - Input when using 3-arg form
 * @throws InvalidRequestError if validation fails
 */
export function validateXrpcInput(
  lexiconsOrNsid: typeof lexicons | string,
  nsidOrInput: unknown,
  maybeInput?: unknown
): void {
  const lex = typeof lexiconsOrNsid === 'string' ? lexicons : lexiconsOrNsid;
  const nsid = typeof lexiconsOrNsid === 'string' ? lexiconsOrNsid : (nsidOrInput as string);
  const input = typeof lexiconsOrNsid === 'string' ? nsidOrInput : maybeInput;

  try {
    lex.assertValidXrpcInput(nsid, input);
  } catch (err) {
    if (err instanceof LexiconValidationError) {
      throw new InvalidRequestError(err.message);
    }
    throw err;
  }
}

/**
 * Validates XRPC output (response body) against a lexicon schema.
 *
 * @param lexiconsOrNsid - Lexicons instance or NSID of the method
 * @param nsidOrOutput - NSID or output body to validate
 * @param maybeOutput - Output when using 3-arg form
 * @throws InternalServerError if validation fails
 *
 * @remarks
 * Output validation errors are internal errors (500) since they indicate
 * the server produced invalid data.
 */
export function validateXrpcOutput(
  lexiconsOrNsid: typeof lexicons | string,
  nsidOrOutput: unknown,
  maybeOutput?: unknown
): void {
  const lex = typeof lexiconsOrNsid === 'string' ? lexicons : lexiconsOrNsid;
  const nsid = typeof lexiconsOrNsid === 'string' ? lexiconsOrNsid : (nsidOrOutput as string);
  const output = typeof lexiconsOrNsid === 'string' ? nsidOrOutput : maybeOutput;

  try {
    lex.assertValidXrpcOutput(nsid, output);
  } catch (err) {
    if (err instanceof LexiconValidationError) {
      throw new InternalServerError(`Invalid response: ${err.message}`);
    }
    throw err;
  }
}

/**
 * Safe validation that returns a result instead of throwing.
 *
 * @param nsid - NSID of the method
 * @param params - Parameters to validate
 * @returns Validation result with success flag and optional error
 */
export function safeValidateParams(
  nsid: string,
  params: Record<string, unknown>
): { success: true } | { success: false; error: string } {
  try {
    lexicons.assertValidXrpcParams(nsid, params);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Validation failed',
    };
  }
}

/**
 * Checks if a lexicon method exists.
 *
 * @param nsid - NSID to check
 * @returns true if method exists
 */
export function hasMethod(nsid: string): boolean {
  try {
    const def = lexicons.getDef(nsid);
    return def !== undefined && (def.type === 'query' || def.type === 'procedure');
  } catch {
    return false;
  }
}

/**
 * Gets the type of a lexicon method.
 *
 * @param nsid - NSID of the method
 * @returns 'query' | 'procedure' | undefined
 */
export function getMethodType(nsid: string): 'query' | 'procedure' | undefined {
  try {
    const def = lexicons.getDef(nsid);
    if (def?.type === 'query' || def?.type === 'procedure') {
      return def.type;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
