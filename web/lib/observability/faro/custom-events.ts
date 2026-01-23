/**
 * Custom event definitions for Chive analytics.
 *
 * @remarks
 * Provides type-safe event tracking for business-critical user actions.
 * All events are sent to Faro with privacy scrubbing applied.
 *
 * @packageDocumentation
 */

import { getFaro } from './initialize';
import { scrubString } from './privacy';

/**
 * Event attributes common to all events.
 */
interface BaseEventAttributes {
  /** Timestamp (ISO string) */
  timestamp?: string;
  /** Page path where event occurred */
  path?: string;
}

/**
 * Eprint view event attributes.
 */
export interface EprintViewEventAttributes extends BaseEventAttributes {
  /** Eprint AT-URI */
  eprintUri: string;
  /** View source (search, browse, direct, share) */
  source: 'search' | 'browse' | 'direct' | 'share' | 'recommendation';
  /** Search query if from search */
  searchQuery?: string;
  /** Position in search results */
  searchPosition?: number;
}

/**
 * Eprint download event attributes.
 */
export interface EprintDownloadEventAttributes extends BaseEventAttributes {
  /** Eprint AT-URI */
  eprintUri: string;
  /** Download format */
  format: 'pdf' | 'source' | 'metadata';
  /** Version number */
  version?: number;
}

/**
 * Search event attributes.
 */
export interface SearchEventAttributes extends BaseEventAttributes {
  /** Search query */
  query: string;
  /** Number of results */
  resultCount: number;
  /** Search filters applied */
  filters?: Record<string, string>;
  /** Time to first result (ms) */
  latency?: number;
}

/**
 * Search click event attributes.
 */
export interface SearchClickEventAttributes extends BaseEventAttributes {
  /** Search query */
  query: string;
  /** Clicked item URI */
  itemUri: string;
  /** Position in results (0-indexed) */
  position: number;
  /** Page number */
  page?: number;
}

/**
 * User action event attributes.
 */
export interface UserActionEventAttributes extends BaseEventAttributes {
  /** Action type */
  action: 'login' | 'logout' | 'submit' | 'endorse' | 'vote' | 'comment' | 'tag';
  /** Target entity URI (if applicable) */
  targetUri?: string;
  /** Action result */
  result?: 'success' | 'failure' | 'cancelled';
}

/**
 * Field browse event attributes.
 */
export interface FieldBrowseEventAttributes extends BaseEventAttributes {
  /** Field URI or slug */
  fieldId: string;
  /** Field name */
  fieldName: string;
  /** Navigation depth */
  depth?: number;
}

/**
 * Author view event attributes.
 */
export interface AuthorViewEventAttributes extends BaseEventAttributes {
  /** Author DID (will be hashed) */
  authorDid: string;
  /** View source */
  source: 'search' | 'eprint' | 'direct';
}

/**
 * Safely push an event to Faro with privacy scrubbing.
 */
function pushEvent(name: string, attributes: Record<string, unknown>): void {
  const faro = getFaro();
  if (!faro) return;

  try {
    // Add common attributes
    const fullAttributes: Record<string, string> = {
      timestamp: new Date().toISOString(),
    };

    // Add path if in browser
    if (typeof window !== 'undefined') {
      fullAttributes['path'] = window.location.pathname;
    }

    // Add scrubbed attributes
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined && value !== null) {
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        fullAttributes[key] = scrubString(stringValue);
      }
    }

    faro.api.pushEvent(name, fullAttributes);
  } catch {
    // Silently fail
  }
}

/**
 * Hash a DID for privacy while maintaining correlation.
 */
function hashDid(did: string): string {
  let hash = 0;
  for (let i = 0; i < did.length; i++) {
    const char = did.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `did_h_${Math.abs(hash).toString(16)}`;
}

/**
 * Custom event tracking functions for Chive.
 *
 * @example
 * ```typescript
 * import { events } from '@/lib/observability';
 *
 * // Track eprint view
 * events.eprintView({
 *   eprintUri: 'at://did:plc:xxx/pub.chive.eprint.submission/xxx',
 *   source: 'search',
 *   searchQuery: 'quantum computing',
 *   searchPosition: 0,
 * });
 *
 * // Track search
 * events.search({
 *   query: 'machine learning',
 *   resultCount: 42,
 *   filters: { field: 'cs.AI' },
 *   latency: 120,
 * });
 * ```
 */
export const events = {
  /**
   * Track eprint page view.
   */
  eprintView(attrs: EprintViewEventAttributes): void {
    pushEvent('eprint_view', attrs as unknown as Record<string, unknown>);
  },

  /**
   * Track eprint download.
   */
  eprintDownload(attrs: EprintDownloadEventAttributes): void {
    pushEvent('eprint_download', attrs as unknown as Record<string, unknown>);
  },

  /**
   * Track search query.
   */
  search(attrs: SearchEventAttributes): void {
    pushEvent('search', {
      ...attrs,
      // Truncate long queries
      query: attrs.query.substring(0, 200),
    });
  },

  /**
   * Track search result click.
   */
  searchClick(attrs: SearchClickEventAttributes): void {
    pushEvent('search_click', {
      ...attrs,
      query: attrs.query.substring(0, 200),
    });
  },

  /**
   * Track user action.
   */
  userAction(attrs: UserActionEventAttributes): void {
    pushEvent('user_action', attrs as unknown as Record<string, unknown>);
  },

  /**
   * Track field browse navigation.
   */
  fieldBrowse(attrs: FieldBrowseEventAttributes): void {
    pushEvent('field_browse', attrs as unknown as Record<string, unknown>);
  },

  /**
   * Track author page view.
   */
  authorView(attrs: AuthorViewEventAttributes): void {
    pushEvent('author_view', {
      ...attrs,
      // Hash DID for privacy
      authorDid: hashDid(attrs.authorDid),
    });
  },

  /**
   * Track generic custom event.
   */
  custom(name: string, attributes?: Record<string, unknown>): void {
    pushEvent(name, attributes ?? {});
  },

  /**
   * Track timing measurement.
   */
  timing(name: string, durationMs: number, attributes?: Record<string, string>): void {
    const faro = getFaro();
    if (!faro) return;

    try {
      faro.api.pushMeasurement({
        type: name,
        values: { duration: durationMs },
      });

      if (attributes) {
        pushEvent(`${name}_timing`, {
          duration: durationMs,
          ...attributes,
        });
      }
    } catch {
      // Silently fail
    }
  },

  /**
   * Create a timing tracker for async operations.
   *
   * @param name - Timing measurement name
   * @returns Object with end() method
   *
   * @example
   * ```typescript
   * const timer = events.startTiming('api_call');
   * await fetchData();
   * timer.end({ endpoint: '/api/eprints' });
   * ```
   */
  startTiming(name: string): { end: (attributes?: Record<string, string>) => void } {
    const start = performance.now();
    return {
      end: (attributes?: Record<string, string>) => {
        const duration = Math.round(performance.now() - start);
        events.timing(name, duration, attributes);
      },
    };
  },
};
