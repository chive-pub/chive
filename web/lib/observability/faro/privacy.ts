/**
 * Privacy utilities for Faro observability.
 *
 * @remarks
 * Provides PII scrubbing and sensitive data redaction to ensure
 * no personal information is sent to the observability backend.
 *
 * @packageDocumentation
 */

/**
 * Patterns for detecting sensitive data.
 */
const SENSITIVE_PATTERNS = {
  /** Email addresses */
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  /** AT Protocol DIDs (did:plc:..., did:web:...) */
  did: /\bdid:(plc|web):[a-z0-9]+\b/gi,
  /** AT Protocol handles (@user.bsky.social) */
  handle: /@[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}/g,
  /** JWT tokens */
  jwt: /\beyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g,
  /** Bearer tokens in strings */
  bearerToken: /Bearer\s+[A-Za-z0-9-_]+/gi,
  /** API keys (common patterns) */
  apiKey: /\b(api[_-]?key|apikey)[=:]\s*['"]?[A-Za-z0-9-_]{16,}['"]?/gi,
  /** Credit card numbers (basic pattern) */
  creditCard: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
  /** SSN (US format) */
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  /** Phone numbers (various formats) */
  phone: /\b(\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g,
  /** IP addresses */
  ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
};

/**
 * URL query parameters to scrub.
 */
const SENSITIVE_QUERY_PARAMS = [
  'token',
  'access_token',
  'refresh_token',
  'api_key',
  'apikey',
  'key',
  'secret',
  'password',
  'pwd',
  'auth',
  'authorization',
  'session',
  'sessionid',
  'code', // OAuth authorization codes
];

/**
 * HTTP headers to redact.
 */
const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-access-token',
  'x-refresh-token',
  'x-session-id',
  'dpop',
];

/**
 * Redaction placeholder.
 */
const REDACTED = '[REDACTED]';

/**
 * Scrub sensitive patterns from a string.
 *
 * @param input - String to scrub
 * @returns Scrubbed string
 */
export function scrubString(input: string): string {
  if (!input || typeof input !== 'string') return input;

  let result = input;

  // Apply all pattern-based redactions
  for (const pattern of Object.values(SENSITIVE_PATTERNS)) {
    result = result.replace(pattern, REDACTED);
  }

  return result;
}

/**
 * Scrub sensitive query parameters from a URL.
 *
 * @param url - URL to scrub
 * @returns Scrubbed URL
 */
export function scrubUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;

  try {
    const parsed = new URL(url, 'http://localhost');
    let modified = false;

    for (const param of SENSITIVE_QUERY_PARAMS) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, REDACTED);
        modified = true;
      }
    }

    if (modified) {
      // Return only path + query if it was a relative URL
      if (url.startsWith('/')) {
        return parsed.pathname + parsed.search;
      }
      return parsed.toString();
    }

    return url;
  } catch {
    // If URL parsing fails, still scrub patterns
    return scrubString(url);
  }
}

/**
 * Scrub sensitive headers from a headers object.
 *
 * @param headers - Headers object to scrub
 * @returns New headers object with sensitive values redacted
 */
export function scrubHeaders(
  headers: Record<string, string | undefined>
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
      result[key] = REDACTED;
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Deep scrub an object for sensitive data.
 *
 * @param obj - Object to scrub
 * @param depth - Current recursion depth
 * @returns Scrubbed object
 */
export function scrubObject(obj: unknown, depth = 0): unknown {
  // Prevent infinite recursion
  if (depth > 10) return obj;

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return scrubString(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => scrubObject(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Check if key itself suggests sensitive data
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('api_key') ||
        lowerKey.includes('authorization') ||
        lowerKey.includes('credential') ||
        lowerKey.includes('private')
      ) {
        result[key] = REDACTED;
      } else {
        result[key] = scrubObject(value, depth + 1);
      }
    }

    return result;
  }

  return obj;
}

/**
 * Scrub error message for sensitive data.
 *
 * @param error - Error object
 * @returns Scrubbed error message
 */
export function scrubError(error: Error): { message: string; stack?: string } {
  return {
    message: scrubString(error.message),
    stack: error.stack ? scrubString(error.stack) : undefined,
  };
}

/**
 * Create a Faro BeforeSend hook that scrubs sensitive data.
 *
 * @returns BeforeSend function for Faro configuration
 */
export function createPrivacyBeforeSend() {
  return (item: unknown): unknown => {
    return scrubObject(item);
  };
}
