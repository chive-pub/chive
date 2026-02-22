/**
 * Shared types for collection XRPC handlers.
 *
 * @packageDocumentation
 * @public
 */

/**
 * Collection view for API responses.
 *
 * @public
 */
export interface CollectionView {
  /** AT-URI of the collection. */
  uri: string;
  /** Content identifier. */
  cid: string;
  /** DID of the collection owner. */
  ownerDid: string;
  /** Display label. */
  label: string;
  /** Optional description. */
  description?: string;
  /** Visibility setting. */
  visibility: 'public' | 'private';
  /** Number of items in the collection. */
  itemCount: number;
  /** Creation timestamp (ISO 8601). */
  createdAt: string;
  /** Last update timestamp (ISO 8601). */
  updatedAt?: string;
}
