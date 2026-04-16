/**
 * React hooks for collection data fetching and management.
 *
 * @remarks
 * Provides TanStack Query hooks for creating, updating, deleting, and querying
 * user-curated collections. Collections are personal graph nodes (kind='object',
 * subkind='collection') stored in user PDSes and indexed by Chive from the
 * firehose.
 *
 * Collections support nested hierarchies via SUBCOLLECTION_OF edges and
 * item membership via CONTAINS edges. Both edge types are also graph records
 * in the user's PDS.
 *
 * @example
 * ```tsx
 * import { useMyCollections, useCreateCollection, collectionKeys } from '@/lib/hooks/use-collections';
 *
 * function MyCollections({ did }: { did: string }) {
 *   const { data } = useMyCollections(did);
 *   const createCollection = useCreateCollection();
 *
 *   return (
 *     <CollectionList
 *       collections={data?.collections ?? []}
 *       onCreate={(input) => createCollection.mutateAsync(input)}
 *     />
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError } from '@/lib/errors';
import { api, authApi } from '@/lib/api/client';
import { createLogger } from '@/lib/observability/logger';
import { getCurrentAgent } from '@/lib/auth/oauth-client';
import {
  createCollectionNode,
  updateCollectionNode,
  deleteCollectionNode,
  addItemToCollection,
  removeItemFromCollection,
  addSubcollection,
  removeSubcollection,
  moveSubcollection,
  updateEdgeNote,
  updateEdgeMetadata,
  updatePersonalNode,
  reorderCollectionItems,
  createCosmikMirror,
  updateCosmikCollection,
  deleteCosmikMirror,
  addCosmikItem,
  removeCosmikItem,
  createCosmikFollow,
  deleteCosmikFollow,
  createCosmikCollectionLinkRemoval,
  createMarginAnnotation,
  deleteMarginAnnotation,
  updateMarginAnnotation,
  createMarginBookmark,
  deleteMarginBookmark,
  createMarginReply,
  createMarginLike,
  deleteMarginLike,
  type CreateCollectionNodeInput,
  type UpdateCollectionNodeInput,
  type AddItemToCollectionInput,
  type AddSubcollectionInput,
  type MoveSubcollectionInput,
  type CosmikItemMapping,
  type CosmikConnectionMapping,
} from '@/lib/atproto/record-creator';

const logger = createLogger({ context: { component: 'use-collections' } });

// =============================================================================
// LOCAL TYPES (until collection XRPC endpoints are generated)
// =============================================================================

/**
 * Collection view as returned by the API.
 */
export interface CollectionView {
  uri: string;
  cid: string;
  ownerDid: string;
  ownerHandle?: string;
  label: string;
  description?: string;
  visibility: 'listed' | 'unlisted';
  itemCount: number;
  tags?: string[];
  parentCollectionUri?: string;
  cosmikCollectionUri?: string;
  cosmikCollectionCid?: string;
  cosmikItems?: Record<string, CosmikItemMapping>;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Collection item as returned by the API.
 */
export interface CollectionItemView {
  edgeUri: string;
  itemUri: string;
  itemType: string;
  note?: string;
  order: number;
  addedAt: string;
  /** Resolved title (for eprints) */
  title?: string;
  /** Resolved authors (for eprints) */
  authors?: string[];
  /** Resolved label (for graph nodes) */
  label?: string;
  /** Node kind (for graph nodes) */
  kind?: string;
  /** Node subkind (for graph nodes) */
  subkind?: string;
  /** Description (for graph nodes) */
  description?: string;
  /** Avatar URL (for authors) */
  avatar?: string;
  /** Whether the node is from the community graph or user-created. */
  source?: 'community' | 'personal';
  /** Subkind-specific metadata (e.g., eprintUri, did, handle, clonedFrom). */
  metadata?: Record<string, unknown>;
}

/**
 * An edge between two items within a collection.
 */
export interface InterItemEdge {
  edgeUri?: string;
  sourceUri: string;
  targetUri: string;
  relationSlug: string;
}

/**
 * Response from listing collections.
 */
export interface ListCollectionsResponse {
  collections: CollectionView[];
  cursor?: string;
  hasMore: boolean;
  total?: number;
}

/**
 * Response from getting a single collection with items.
 */
export interface CollectionDetailResponse {
  collection: CollectionView;
  items: CollectionItemView[];
  subcollections: CollectionView[];
  interItemEdges: InterItemEdge[];
}

/**
 * Response from searching collections.
 */
export interface SearchCollectionsResponse {
  collections: CollectionView[];
  cursor?: string;
  total?: number;
}

/**
 * A single event in the collection feed.
 */
export interface CollectionFeedEvent {
  type: string;
  eventUri: string;
  eventAt: string;
  collectionItemUri: string;
  collectionItemSubkind: string;
  collectionItems: { label: string; uri: string }[];
  payload: Record<string, unknown>;
}

/**
 * Response from the collection feed endpoint.
 */
export interface CollectionFeedResponse {
  events: CollectionFeedEvent[];
  cursor?: string;
  hasMore: boolean;
}

// =============================================================================
// QUERY KEY FACTORY
// =============================================================================

/**
 * Query key factory for collection queries.
 *
 * @remarks
 * Follows TanStack Query best practices for hierarchical cache key management.
 *
 * @example
 * ```typescript
 * // Invalidate all collection queries
 * queryClient.invalidateQueries({ queryKey: collectionKeys.all });
 *
 * // Invalidate a specific collection
 * queryClient.invalidateQueries({ queryKey: collectionKeys.detail(collectionUri) });
 *
 * // Invalidate all collections for a user
 * queryClient.invalidateQueries({ queryKey: collectionKeys.myCollections(userDid) });
 * ```
 */
export const collectionKeys = {
  /** Base key for all collection queries */
  all: ['collections'] as const,

  /** Key for a single collection detail */
  detail: (uri: string) => [...collectionKeys.all, 'detail', uri] as const,

  /** Key for a user's own collections */
  myCollections: (did: string) => [...collectionKeys.all, 'my', did] as const,

  /** Key for collections containing a specific item */
  containing: (itemUri: string) => [...collectionKeys.all, 'containing', itemUri] as const,

  /** Key for subcollections of a collection */
  subcollections: (uri: string) => [...collectionKeys.all, 'subcollections', uri] as const,

  /** Key for parent collection of a collection */
  parent: (uri: string) => [...collectionKeys.all, 'parent', uri] as const,

  /** Key for collection search results */
  search: (query: string) => [...collectionKeys.all, 'search', query] as const,

  /** Key for a collection's activity feed */
  feed: (uri: string) => [...collectionKeys.all, 'feed', uri] as const,

  /** Key for public collection listings with filters */
  public: (filters: Record<string, unknown>) => [...collectionKeys.all, 'public', filters] as const,
};

// =============================================================================
// QUERY HOOKS
// =============================================================================

/**
 * Fetches a single collection with its items and subcollections.
 *
 * @param uri - AT-URI of the collection
 * @param options - Hook options
 * @returns Query result with collection detail
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useCollection(collectionUri);
 * if (data) {
 *   console.log(data.collection.label, data.items.length);
 * }
 * ```
 */
export function useCollection(
  uri: string,
  options?: { enabled?: boolean; excludeSubcollectionItems?: boolean }
) {
  return useQuery({
    queryKey: [...collectionKeys.detail(uri), options?.excludeSubcollectionItems ?? false],
    queryFn: async (): Promise<CollectionDetailResponse> => {
      const response = await api.pub.chive.collection.get({
        uri,
        excludeSubcollectionItems: options?.excludeSubcollectionItems,
      });
      return response.data as unknown as CollectionDetailResponse;
    },
    enabled: !!uri && (options?.enabled ?? true),
    staleTime: 30 * 1000,
  });
}

/**
 * Fetches all collections owned by a user.
 *
 * @param did - DID of the user
 * @param options - Hook options
 * @returns Query result with user's collections
 *
 * @example
 * ```tsx
 * const { data } = useMyCollections(currentUser.did);
 * return <CollectionList collections={data?.collections ?? []} />;
 * ```
 */
export function useMyCollections(did: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: collectionKeys.myCollections(did),
    queryFn: async (): Promise<ListCollectionsResponse> => {
      const response = await api.pub.chive.collection.listByOwner({ did, limit: 100 });
      return response.data as unknown as ListCollectionsResponse;
    },
    enabled: !!did && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Fetches public collections with optional tag filter.
 *
 * @param options - Filter and hook options
 * @returns Query result with public collections
 *
 * @example
 * ```tsx
 * const { data } = usePublicCollections({ tag: 'machine-learning', limit: 20 });
 * ```
 */
export function usePublicCollections(options?: {
  tag?: string;
  limit?: number;
  enabled?: boolean;
}) {
  const filters = { tag: options?.tag, limit: options?.limit };

  return useQuery({
    queryKey: collectionKeys.public(filters),
    queryFn: async (): Promise<ListCollectionsResponse> => {
      const response = await api.pub.chive.collection.listPublic({
        tag: options?.tag,
        limit: options?.limit ?? 20,
      });
      return response.data as unknown as ListCollectionsResponse;
    },
    enabled: options?.enabled ?? true,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Fetches collections that contain a specific item.
 *
 * @param itemUri - AT-URI of the item
 * @param options - Hook options
 * @returns Query result with collections containing the item
 *
 * @example
 * ```tsx
 * const { data } = useCollectionsContaining(eprintUri);
 * ```
 */
export function useCollectionsContaining(itemUri: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: collectionKeys.containing(itemUri),
    queryFn: async (): Promise<ListCollectionsResponse> => {
      const response = await api.pub.chive.collection.getContaining({ itemUri });
      return response.data as unknown as ListCollectionsResponse;
    },
    enabled: !!itemUri && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Searches collections by name or description.
 *
 * @param query - Search query text
 * @param options - Hook options
 * @returns Query result with matching collections
 *
 * @example
 * ```tsx
 * const { data } = useSearchCollections('machine learning');
 * ```
 */
export function useSearchCollections(query: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: collectionKeys.search(query),
    queryFn: async (): Promise<SearchCollectionsResponse> => {
      const response = await api.pub.chive.collection.search({ query, limit: 20 });
      return response.data as unknown as SearchCollectionsResponse;
    },
    enabled: query.length >= 2 && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Fetches subcollections of a collection.
 *
 * @param uri - AT-URI of the parent collection
 * @param options - Hook options
 * @returns Query result with subcollections
 */
export function useSubcollections(uri: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: collectionKeys.subcollections(uri),
    queryFn: async (): Promise<ListCollectionsResponse> => {
      const response = await api.pub.chive.collection.getSubcollections({ uri });
      const data = response.data;
      return {
        collections: data.subcollections,
        hasMore: false,
      } as unknown as ListCollectionsResponse;
    },
    enabled: !!uri && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Fetches the parent collection of a collection.
 *
 * @param uri - AT-URI of the child collection
 * @param options - Hook options
 * @returns Query result with parent collection (or null if top-level)
 */
export function useParentCollection(uri: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: collectionKeys.parent(uri),
    queryFn: async (): Promise<CollectionView | null> => {
      try {
        const response = await api.pub.chive.collection.getParent({ uri });
        return (response.data.parent as unknown as CollectionView) ?? null;
      } catch {
        return null;
      }
    },
    enabled: !!uri && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Fetches the activity feed for a collection with infinite scroll pagination.
 *
 * @param uri - AT-URI of the collection
 * @param options - Hook options
 * @returns Infinite query result with paginated feed events
 *
 * @example
 * ```tsx
 * const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useCollectionFeed(uri);
 * const events = data?.pages.flatMap(p => p.events) ?? [];
 * ```
 */
export function useCollectionFeed(uri: string, options?: { limit?: number; enabled?: boolean }) {
  const { limit = 30, enabled = true } = options ?? {};

  return useInfiniteQuery({
    queryKey: collectionKeys.feed(uri),
    queryFn: async ({ pageParam }): Promise<CollectionFeedResponse> => {
      const response = await api.pub.chive.collection.getFeed({
        uri,
        limit,
        cursor: pageParam as string | undefined,
      });
      return response.data as unknown as CollectionFeedResponse;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.cursor : undefined),
    enabled: !!uri && enabled,
    staleTime: 60 * 1000,
  });
}

// =============================================================================
// MUTATION HOOKS
// =============================================================================

/**
 * Input for the useCreateCollection mutation.
 *
 * @remarks
 * Extends CreateCollectionNodeInput with optional item data used for
 * Cosmik mirror creation when enableCosmikMirror is true.
 */
export interface CreateCollectionMutationInput extends CreateCollectionNodeInput {
  /** Items to mirror as Cosmik cards when enableCosmikMirror is true */
  items?: Array<{
    /** URL or AT-URI of the item */
    uri: string;
    /** Display label */
    label: string;
    /** Optional annotation note */
    note?: string;
    /** Item type */
    type?: string;
    /** Additional metadata for rich Semble card content */
    metadata?: {
      subkind?: string;
      description?: string;
      authors?: string[];
      handle?: string;
      kind?: string;
      avatarUrl?: string;
      isPersonal?: boolean;
      doi?: string;
      isbn?: string;
      publishedDate?: string;
      imageUrl?: string;
      journalTitle?: string;
      externalIds?: Array<{
        system: string;
        identifier: string;
        uri?: string;
        matchType?: 'exact' | 'close' | 'broader' | 'narrower' | 'related';
      }>;
    };
  }>;
  /** Inter-item edges to mirror as Cosmik connections when enableCosmikMirror is true */
  edges?: Array<{
    sourceUri: string;
    targetUri: string;
    relationSlug: string;
    note?: string;
  }>;
  /** Collaborator DIDs for shared Cosmik collections */
  collaborators?: string[];
}

/**
 * Mutation hook for creating a new collection.
 *
 * @remarks
 * Creates a collection node in the user's PDS and requests immediate
 * indexing for UI responsiveness. When enableCosmikMirror is true and
 * items are provided, also creates companion network.cosmik.card and
 * network.cosmik.collection records for cross-ecosystem discovery.
 *
 * @example
 * ```tsx
 * const createCollection = useCreateCollection();
 *
 * const handleCreate = async () => {
 *   await createCollection.mutateAsync({
 *     name: 'My Reading List',
 *     visibility: 'listed',
 *     tags: ['nlp'],
 *   });
 * };
 * ```
 *
 * @returns Mutation object for creating collections
 */
export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCollectionMutationInput): Promise<CollectionView> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'createCollection');
      }

      const result = await createCollectionNode(agent, input);

      // Request immediate indexing
      try {
        await authApi.pub.chive.sync.indexRecord({ uri: result.uri });
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (indexError) {
        logger.warn('Immediate indexing failed; firehose will handle', {
          uri: result.uri,
          error: indexError instanceof Error ? indexError.message : String(indexError),
        });
      }

      // Create Cosmik mirror if enabled
      let cosmikCollectionUri: string | undefined;
      let cosmikCollectionCid: string | undefined;
      if (input.enableCosmikMirror) {
        try {
          const cosmikResult = await createCosmikMirror(agent, {
            collectionUri: result.uri,
            title: input.name,
            description: input.description,
            visibility: input.visibility,
            collaborators: input.collaborators,
            items: (input.items ?? []).map((item) => ({
              url: item.uri,
              title: item.label,
              subkind: item.metadata?.subkind,
              itemType: item.type,
              metadata: item.metadata,
            })),
            edges: input.edges,
          });

          cosmikCollectionUri = cosmikResult.cosmikCollectionUri;
          cosmikCollectionCid = cosmikResult.cosmikCollectionCid;

          // Request re-indexing so the server picks up cosmikCollectionUri metadata
          try {
            await authApi.pub.chive.sync.indexRecord({ uri: result.uri });
          } catch {
            // Best-effort
          }

          logger.info('Cosmik mirror created', {
            cosmikCollectionUri: cosmikResult.cosmikCollectionUri,
            itemCount: Object.keys(cosmikResult.cosmikItems).length,
            connectionCount: Object.keys(cosmikResult.cosmikConnections).length,
          });
        } catch (cosmikError) {
          logger.warn('Cosmik mirror creation failed; collection was created without mirror', {
            uri: result.uri,
            error: cosmikError instanceof Error ? cosmikError.message : String(cosmikError),
          });
        }
      }

      return {
        uri: result.uri,
        cid: result.cid,
        ownerDid: agent.did ?? '',
        label: input.name,
        description: input.description,
        visibility: input.visibility,
        itemCount: 0,
        tags: input.tags,
        createdAt: new Date().toISOString(),
        cosmikCollectionUri,
        cosmikCollectionCid,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: collectionKeys.myCollections(data.ownerDid),
      });
      queryClient.invalidateQueries({
        queryKey: collectionKeys.public({}),
      });
    },
  });
}

/**
 * Mutation hook for updating an existing collection.
 *
 * @returns Mutation object for updating collections
 */
export function useUpdateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: UpdateCollectionNodeInput & {
        ownerDid: string;
        cosmikCollectionUri?: string;
      }
    ): Promise<CollectionView> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'updateCollection');
      }

      const result = await updateCollectionNode(agent, input);

      // Request immediate re-indexing
      try {
        await authApi.pub.chive.sync.indexRecord({ uri: result.uri });
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch {
        logger.warn('Immediate re-indexing failed; firehose will handle', { uri: result.uri });
      }

      // Sync changes to Cosmik mirror if enabled
      if (input.cosmikCollectionUri) {
        try {
          await updateCosmikCollection(agent, input.cosmikCollectionUri, {
            name: input.name,
            description: input.description,
            visibility: input.visibility,
          });
        } catch (cosmikError) {
          logger.warn('Cosmik collection update failed', {
            cosmikCollectionUri: input.cosmikCollectionUri,
            error: cosmikError instanceof Error ? cosmikError.message : String(cosmikError),
          });
        }
      }

      return {
        uri: result.uri,
        cid: result.cid,
        ownerDid: input.ownerDid,
        label: input.name ?? '',
        description: input.description,
        visibility: input.visibility ?? 'listed',
        itemCount: 0,
        tags: input.tags,
        cosmikCollectionUri: input.cosmikCollectionUri,
        createdAt: new Date().toISOString(),
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: collectionKeys.detail(data.uri),
      });
      queryClient.invalidateQueries({
        queryKey: collectionKeys.myCollections(data.ownerDid),
      });
    },
  });
}

/**
 * Mutation hook for deleting a collection.
 *
 * @remarks
 * Handles cascade deletion of edges (CONTAINS and SUBCOLLECTION_OF)
 * and optionally re-parents subcollections to the deleted collection's parent.
 *
 * @returns Mutation object for deleting collections
 */
export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      uri,
      ownerDid: _ownerDid,
      cascadeSubcollections,
      deleteSubcollections,
      cosmikCollectionUri,
      cosmikItems,
      subcollections,
    }: {
      uri: string;
      ownerDid: string;
      cascadeSubcollections?: boolean;
      /** When true, recursively delete subcollections instead of re-linking */
      deleteSubcollections?: boolean;
      cosmikCollectionUri?: string;
      cosmikItems?: Record<string, CosmikItemMapping>;
      /** Subcollection data for recursive deletion and Semble cleanup */
      subcollections?: Array<{
        uri: string;
        cosmikCollectionUri?: string;
        cosmikItems?: Record<string, CosmikItemMapping>;
      }>;
    }): Promise<void> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'deleteCollection');
      }

      // Delete subcollections first if requested
      if (deleteSubcollections && subcollections) {
        for (const sub of subcollections) {
          // Delete subcollection's Semble mirror (best-effort)
          if (sub.cosmikCollectionUri) {
            try {
              await deleteCosmikMirror(agent, sub.cosmikCollectionUri, sub.cosmikItems);
            } catch (cosmikError) {
              logger.warn('Subcollection Cosmik mirror deletion failed', {
                cosmikCollectionUri: sub.cosmikCollectionUri,
                error: cosmikError instanceof Error ? cosmikError.message : String(cosmikError),
              });
            }
          }

          // Delete the subcollection node and its edges
          try {
            await deleteCollectionNode(agent, sub.uri);
          } catch (subError) {
            logger.warn('Subcollection deletion failed', {
              uri: sub.uri,
              error: subError instanceof Error ? subError.message : String(subError),
            });
          }

          // Request immediate deletion indexing
          try {
            await authApi.pub.chive.sync.deleteRecord({ uri: sub.uri });
          } catch {
            logger.warn('Subcollection deletion indexing failed; firehose will handle', {
              uri: sub.uri,
            });
          }
        }
      }

      // Delete parent collection's Cosmik mirror (best-effort)
      if (cosmikCollectionUri) {
        try {
          await deleteCosmikMirror(agent, cosmikCollectionUri, cosmikItems);
        } catch (cosmikError) {
          logger.warn('Cosmik mirror deletion failed', {
            cosmikCollectionUri,
            error: cosmikError instanceof Error ? cosmikError.message : String(cosmikError),
          });
        }
      }

      await deleteCollectionNode(agent, uri, { cascadeSubcollections });

      // Request immediate deletion indexing
      try {
        await authApi.pub.chive.sync.deleteRecord({ uri });
      } catch {
        logger.warn('Immediate deletion indexing failed; firehose will handle', { uri });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: collectionKeys.myCollections(variables.ownerDid),
      });
      // Remove the detail cache instead of refetching (the collection no longer exists)
      queryClient.removeQueries({
        queryKey: collectionKeys.detail(variables.uri),
      });
      // Also remove subcollection detail caches if they were deleted
      if (variables.deleteSubcollections && variables.subcollections) {
        for (const sub of variables.subcollections) {
          queryClient.removeQueries({
            queryKey: collectionKeys.detail(sub.uri),
          });
        }
      }
      queryClient.invalidateQueries({
        queryKey: collectionKeys.public({}),
      });
    },
  });
}

/**
 * Mutation hook for adding an item to a collection.
 *
 * @returns Mutation object for adding items
 */
export function useAddToCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: AddItemToCollectionInput & {
        cosmikCollectionUri?: string;
        cosmikCollectionCid?: string;
        /** URL for the Cosmik card (the item's AT-URI or external URL) */
        itemUrl?: string;
        /** Display title for the Cosmik card */
        itemTitle?: string;
        /** Node subkind for rich Semble card metadata */
        itemSubkind?: string;
        /** Item type from the wizard (eprint, author, graphNode) */
        itemType?: string;
        /** Additional item metadata for rich Semble card content */
        itemMetadata?: {
          subkind?: string;
          description?: string;
          authors?: string[];
          handle?: string;
          kind?: string;
          avatarUrl?: string;
          isPersonal?: boolean;
        };
      }
    ): Promise<{ edgeUri: string }> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'addToCollection');
      }

      const result = await addItemToCollection(agent, input);

      // Request immediate indexing of the edge
      try {
        await authApi.pub.chive.sync.indexRecord({ uri: result.uri });
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch {
        logger.warn('Immediate indexing failed; firehose will handle', { uri: result.uri });
      }

      // Create Cosmik card + link if mirror is active
      if (input.cosmikCollectionUri && input.cosmikCollectionCid && input.itemUrl) {
        try {
          await addCosmikItem(agent, {
            chiveCollectionUri: input.collectionUri,
            cosmikCollectionUri: input.cosmikCollectionUri,
            cosmikCollectionCid: input.cosmikCollectionCid,
            url: input.itemUrl,
            title: input.itemTitle,
            subkind: input.itemSubkind,
            itemType: input.itemType,
            itemMetadata: input.itemMetadata,
          });

          // Re-index so the server picks up the updated cosmikItems metadata
          try {
            await authApi.pub.chive.sync.indexRecord({ uri: input.collectionUri });
          } catch {
            // Best-effort
          }
        } catch (cosmikError) {
          logger.warn('Cosmik item creation failed', {
            cosmikCollectionUri: input.cosmikCollectionUri,
            itemUrl: input.itemUrl,
            error: cosmikError instanceof Error ? cosmikError.message : String(cosmikError),
          });
        }
      }

      return { edgeUri: result.uri };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: collectionKeys.detail(variables.collectionUri),
      });
      queryClient.invalidateQueries({
        queryKey: collectionKeys.containing(variables.itemUri),
      });
    },
  });
}

/**
 * Response from the findContainsEdge endpoint.
 */
export interface FindContainsEdgeResponse {
  found: boolean;
  edgeUri?: string;
  parentCollectionUri?: string;
  cosmikCardUri?: string;
  cosmikLinkUri?: string;
  cosmikItemUrl?: string;
}

/**
 * Finds the CONTAINS edge between a collection and an item.
 *
 * @param collectionUri - AT-URI of the collection
 * @param itemUri - AT-URI of the item
 * @returns Edge information including Cosmik mapping
 */
export async function findContainsEdge(
  collectionUri: string,
  itemUri: string
): Promise<FindContainsEdgeResponse> {
  const response = await api.pub.chive.collection.findContainsEdge({
    collectionUri,
    itemUri,
  });
  return response.data as unknown as FindContainsEdgeResponse;
}

/**
 * Fetches subcollection URIs for a collection (non-hook imperative call).
 */
export async function getSubcollectionUris(collectionUri: string): Promise<string[]> {
  try {
    const response = await api.pub.chive.collection.getSubcollections({ uri: collectionUri });
    const data = response.data as unknown as { subcollections: Array<{ uri: string }> };
    return data.subcollections.map((s) => s.uri);
  } catch {
    return [];
  }
}

/**
 * Mutation hook for removing an item from a collection.
 *
 * @returns Mutation object for removing items
 */
export function useRemoveFromCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      edgeUri,
      collectionUri,
      itemUri: _itemUri,
      cosmikCardUri,
      cosmikLinkUri,
      cosmikItemUrl,
    }: {
      edgeUri: string;
      collectionUri: string;
      itemUri: string;
      cosmikCardUri?: string;
      cosmikLinkUri?: string;
      /** URL key used in cosmikItems metadata to remove the mapping */
      cosmikItemUrl?: string;
    }): Promise<void> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'removeFromCollection');
      }

      await removeItemFromCollection(agent, edgeUri);

      // Request immediate deletion indexing
      try {
        await authApi.pub.chive.sync.deleteRecord({ uri: edgeUri });
      } catch {
        logger.warn('Immediate deletion indexing failed; firehose will handle', { uri: edgeUri });
      }

      // Remove Cosmik card + link if mirror is active
      if (cosmikCardUri && cosmikLinkUri && cosmikItemUrl) {
        try {
          await removeCosmikItem(agent, {
            chiveCollectionUri: collectionUri,
            url: cosmikItemUrl,
            cardUri: cosmikCardUri,
            linkUri: cosmikLinkUri,
          });

          // Also prune any orphan inter-item Cosmik connections that
          // referenced the removed item. Without this, Semble would still
          // display edges pointing at a card that no longer exists.
          try {
            const { deleteCosmikConnectionsForItem } = await import('@/lib/atproto/record-creator');
            await deleteCosmikConnectionsForItem(agent, collectionUri, cosmikItemUrl);
          } catch (connectionErr) {
            logger.warn('Failed to prune orphan Cosmik connections', {
              collectionUri,
              cosmikItemUrl,
              error: connectionErr instanceof Error ? connectionErr.message : String(connectionErr),
            });
          }

          // Re-index so server picks up updated metadata
          try {
            await authApi.pub.chive.sync.indexRecord({ uri: collectionUri });
          } catch {
            // Best-effort
          }
        } catch (cosmikError) {
          logger.warn('Cosmik item removal failed', {
            cosmikCardUri,
            cosmikLinkUri,
            error: cosmikError instanceof Error ? cosmikError.message : String(cosmikError),
          });
        }
      }
    },
    onMutate: async (variables) => {
      const detailPrefix = collectionKeys.detail(variables.collectionUri);
      const containingKey = collectionKeys.containing(variables.itemUri);
      await queryClient.cancelQueries({ queryKey: detailPrefix });
      await queryClient.cancelQueries({ queryKey: containingKey });

      // Collect all matching detail queries (e.g. with different
      // excludeSubcollectionItems suffixes) for optimistic update.
      const previousEntries = queryClient.getQueriesData<CollectionDetailResponse>({
        queryKey: detailPrefix,
      });
      for (const [key, data] of previousEntries) {
        if (data) {
          queryClient.setQueryData(key, {
            ...data,
            items: data.items.filter((item) => item.edgeUri !== variables.edgeUri),
          });
        }
      }

      // Optimistically remove this collection from the "containing" cache
      const previousContaining = queryClient.getQueryData<ListCollectionsResponse>(containingKey);
      if (previousContaining) {
        queryClient.setQueryData(containingKey, {
          ...previousContaining,
          collections: previousContaining.collections.filter(
            (c) => c.uri !== variables.collectionUri
          ),
        });
      }

      return { previousEntries, previousContaining };
    },
    onError: (_err, variables, context) => {
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries) {
          if (data) {
            queryClient.setQueryData(key, data);
          }
        }
      }
      if (context?.previousContaining) {
        queryClient.setQueryData(
          collectionKeys.containing(variables.itemUri),
          context.previousContaining
        );
      }
    },
    onSettled: (_data, error, variables) => {
      // Always invalidate "containing" queries so other UIs update
      queryClient.invalidateQueries({
        queryKey: collectionKeys.containing(variables.itemUri),
      });
      // Only refetch the detail query on error. On success the optimistic
      // update is correct and an immediate refetch would race with firehose
      // indexing, potentially restoring the deleted item.
      if (error) {
        queryClient.invalidateQueries({
          queryKey: collectionKeys.detail(variables.collectionUri),
        });
      }
    },
  });
}

/**
 * Mutation hook for reordering items within a collection.
 *
 * @returns Mutation object for reordering items
 */
export function useReorderItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      collectionUri,
      itemOrder,
    }: {
      collectionUri: string;
      itemOrder: string[];
    }): Promise<void> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'reorderItems');
      }

      await reorderCollectionItems(agent, collectionUri, itemOrder);

      // Request immediate re-indexing
      try {
        await authApi.pub.chive.sync.indexRecord({ uri: collectionUri });
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch {
        logger.warn('Immediate re-indexing failed; firehose will handle', {
          uri: collectionUri,
        });
      }
    },
    onMutate: async (variables) => {
      const detailPrefix = collectionKeys.detail(variables.collectionUri);
      await queryClient.cancelQueries({ queryKey: detailPrefix });

      const previousEntries = queryClient.getQueriesData<CollectionDetailResponse>({
        queryKey: detailPrefix,
      });
      const orderMap = new Map(variables.itemOrder.map((uri, idx) => [uri, idx]));
      for (const [key, data] of previousEntries) {
        if (data) {
          const sorted = [...data.items].sort(
            (a, b) => (orderMap.get(a.edgeUri) ?? 0) - (orderMap.get(b.edgeUri) ?? 0)
          );
          queryClient.setQueryData(key, { ...data, items: sorted });
        }
      }
      return { previousEntries };
    },
    onError: (_err, variables, context) => {
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries) {
          if (data) {
            queryClient.setQueryData(key, data);
          }
        }
      }
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({
        queryKey: collectionKeys.detail(variables.collectionUri),
      });
    },
  });
}

/**
 * Mutation hook for updating a note on a collection item.
 *
 * @returns Mutation object for updating item notes
 */
export function useUpdateItemNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      edgeUri,
      note,
    }: {
      edgeUri: string;
      collectionUri: string;
      note: string;
    }): Promise<void> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'updateItemNote');
      }

      const result = await updateEdgeNote(agent, edgeUri, note);

      // Request immediate re-indexing
      try {
        await authApi.pub.chive.sync.indexRecord({ uri: result.uri });
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch {
        logger.warn('Immediate re-indexing failed; firehose will handle', { uri: result.uri });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: collectionKeys.detail(variables.collectionUri),
      });
    },
  });
}

/**
 * Mutation hook for updating a collection item's label and/or note.
 *
 * @returns Mutation object for updating item metadata
 */
export function useUpdateCollectionItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      edgeUri,
      collectionUri,
      itemUri,
      label,
      note,
    }: {
      edgeUri: string;
      collectionUri: string;
      itemUri?: string;
      label?: string;
      note?: string;
    }): Promise<void> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'updateCollectionItem');
      }

      // Update the node record directly if itemUri is provided and owned by user
      if (itemUri && label !== undefined) {
        try {
          const nodeResult = await updatePersonalNode(agent, itemUri, { label });
          try {
            await authApi.pub.chive.sync.indexRecord({ uri: nodeResult.uri });
          } catch {
            logger.warn('Node re-indexing failed; firehose will handle', { uri: nodeResult.uri });
          }
        } catch {
          logger.warn('Could not update node directly, falling back to edge metadata', { itemUri });
        }
      }

      // Update edge metadata (label override + note)
      const result = await updateEdgeMetadata(agent, edgeUri, { label, note });

      // Request immediate re-indexing
      try {
        await authApi.pub.chive.sync.indexRecord({ uri: result.uri });
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch {
        logger.warn('Immediate re-indexing failed; firehose will handle', { uri: result.uri });
      }

      // Sync label change to Cosmik card if the collection has a mirror
      if (label !== undefined && itemUri) {
        try {
          const { loadEdgeSyncLookup, updateCosmikCard } =
            await import('@/lib/atproto/record-creator');
          const lookup = await loadEdgeSyncLookup(agent, collectionUri);
          if (lookup) {
            // cosmikItems is keyed by original item URI (may differ from the
            // personal-graph URI). Extract the rkey from itemUri and match
            // against keys that share the same rkey.
            const itemRkey = itemUri.split('/').pop();
            for (const [key, mapping] of Object.entries(lookup.cosmikItems)) {
              if (key === itemUri || (itemRkey && key.endsWith(`/${itemRkey}`))) {
                await updateCosmikCard(agent, mapping.cardUri, { title: label });
                break;
              }
            }
          }
        } catch (syncErr) {
          logger.warn('Cosmik card label sync failed', {
            itemUri,
            error: syncErr instanceof Error ? syncErr.message : String(syncErr),
          });
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: collectionKeys.detail(variables.collectionUri),
      });
    },
  });
}

/**
 * Mutation hook for adding a subcollection relationship.
 *
 * @returns Mutation object for adding subcollections
 */
export function useAddSubcollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddSubcollectionInput): Promise<{ edgeUri: string }> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'addSubcollection');
      }

      const result = await addSubcollection(agent, input);

      // Request immediate indexing
      try {
        await authApi.pub.chive.sync.indexRecord({ uri: result.uri });
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch {
        logger.warn('Immediate indexing failed; firehose will handle', { uri: result.uri });
      }

      return { edgeUri: result.uri };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: collectionKeys.subcollections(variables.parentCollectionUri),
      });
      queryClient.invalidateQueries({
        queryKey: collectionKeys.parent(variables.childCollectionUri),
      });
      queryClient.invalidateQueries({
        queryKey: collectionKeys.detail(variables.parentCollectionUri),
      });
    },
  });
}

/**
 * Mutation hook for removing a subcollection relationship.
 *
 * @remarks
 * Only removes the SUBCOLLECTION_OF edge; the subcollection node is not deleted.
 *
 * @returns Mutation object for removing subcollections
 */
export function useRemoveSubcollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      edgeUri,
    }: {
      edgeUri: string;
      parentCollectionUri: string;
      childCollectionUri: string;
    }): Promise<void> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'removeSubcollection');
      }

      await removeSubcollection(agent, edgeUri);

      // Request immediate deletion indexing
      try {
        await authApi.pub.chive.sync.deleteRecord({ uri: edgeUri });
      } catch {
        logger.warn('Immediate deletion indexing failed; firehose will handle', { uri: edgeUri });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: collectionKeys.subcollections(variables.parentCollectionUri),
      });
      queryClient.invalidateQueries({
        queryKey: collectionKeys.parent(variables.childCollectionUri),
      });
      queryClient.invalidateQueries({
        queryKey: collectionKeys.detail(variables.parentCollectionUri),
      });
    },
  });
}

/**
 * Mutation hook for moving a subcollection to a new parent.
 *
 * @returns Mutation object for moving subcollections
 */
export function useMoveSubcollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: MoveSubcollectionInput & {
        oldParentUri: string;
      }
    ): Promise<void> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'moveSubcollection');
      }

      await moveSubcollection(agent, input);
    },
    onSuccess: (_, variables) => {
      // Invalidate old parent's subcollections
      queryClient.invalidateQueries({
        queryKey: collectionKeys.subcollections(variables.oldParentUri),
      });
      queryClient.invalidateQueries({
        queryKey: collectionKeys.detail(variables.oldParentUri),
      });
      // Invalidate new parent's subcollections
      queryClient.invalidateQueries({
        queryKey: collectionKeys.subcollections(variables.newParentUri),
      });
      queryClient.invalidateQueries({
        queryKey: collectionKeys.detail(variables.newParentUri),
      });
      // Invalidate the moved subcollection's parent query
      queryClient.invalidateQueries({
        queryKey: collectionKeys.parent(variables.subcollectionUri),
      });
    },
  });
}

// =============================================================================
// COSMIK FOLLOW HOOKS
// =============================================================================

/**
 * Query key factory for follow queries.
 */
export const followKeys = {
  all: ['follows'] as const,
  status: (followerDid: string, subject: string) =>
    [...followKeys.all, 'status', followerDid, subject] as const,
  count: (subject: string) => [...followKeys.all, 'count', subject] as const,
};

/**
 * Fetches the follower count for a collection.
 *
 * @param collectionUri - AT-URI of the collection
 * @param options - Hook options
 * @returns Query result with follower count
 */
export function useFollowerCount(collectionUri: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: followKeys.count(collectionUri),
    queryFn: async (): Promise<{ count: number }> => {
      const response = await api.pub.chive.collection.getFollowerCount({
        uri: collectionUri,
      });
      return response.data as unknown as { count: number };
    },
    enabled: !!collectionUri && (options?.enabled ?? true),
    staleTime: 60 * 1000,
  });
}

/**
 * Checks if the current user follows a collection.
 *
 * @param followerDid - DID of the current user
 * @param subject - AT-URI of the collection to check
 * @param options - Hook options
 * @returns Query result with follow URI or null
 */
export function useFollowStatus(
  followerDid: string,
  subject: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: followKeys.status(followerDid, subject),
    queryFn: async (): Promise<{ followUri: string | null }> => {
      const response = await api.pub.chive.collection.getFollowStatus({
        followerDid,
        subject,
      });
      return response.data as unknown as { followUri: string | null };
    },
    enabled: !!followerDid && !!subject && (options?.enabled ?? true),
    staleTime: 30 * 1000,
  });
}

/**
 * Mutation hook for following a collection.
 *
 * @returns Mutation object for creating a follow
 */
export function useFollowCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subject,
    }: {
      subject: string;
      followerDid: string;
    }): Promise<{ followUri: string }> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'followCollection');
      }

      const result = await createCosmikFollow(agent, subject);
      return { followUri: result.uri };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: followKeys.status(variables.followerDid, variables.subject),
      });
      queryClient.invalidateQueries({
        queryKey: followKeys.count(variables.subject),
      });
    },
  });
}

/**
 * Mutation hook for unfollowing a collection.
 *
 * @returns Mutation object for deleting a follow
 */
export function useUnfollowCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      followUri,
    }: {
      followUri: string;
      subject: string;
      followerDid: string;
    }): Promise<void> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'unfollowCollection');
      }

      await deleteCosmikFollow(agent, followUri);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: followKeys.status(variables.followerDid, variables.subject),
      });
      queryClient.invalidateQueries({
        queryKey: followKeys.count(variables.subject),
      });
    },
  });
}

// =============================================================================
// MARGIN ANNOTATION HOOKS
// =============================================================================

/**
 * Query key factory for Margin annotation queries.
 */
export const marginKeys = {
  all: ['margin'] as const,
  annotations: (eprintUri: string) => [...marginKeys.all, 'annotations', eprintUri] as const,
};

/**
 * Fetches Margin annotations for an eprint.
 *
 * @param eprintUri - AT-URI of the eprint
 * @param options - Hook options
 * @returns Query result with annotations
 */
export function useMarginAnnotations(eprintUri: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: marginKeys.annotations(eprintUri),
    queryFn: async () => {
      const response = await api.pub.chive.collection.getMarginAnnotations({
        eprintUri,
        limit: 50,
      });
      return response.data;
    },
    enabled: !!eprintUri && (options?.enabled ?? true),
    staleTime: 60 * 1000,
  });
}

/**
 * Mutation hook for creating a Margin annotation (dual-write from Chive review).
 *
 * @returns Mutation object for creating annotations
 */
export function useCreateMarginAnnotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      sourceUrl: string;
      pageTitle?: string;
      body?: string;
      bodyFormat?: string;
      motivation?: 'commenting' | 'assessing' | 'highlighting';
      tags?: string[];
      eprintUri: string;
    }): Promise<{ annotationUri: string; annotationCid: string }> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError(
          'Not authenticated. Please log in again.',
          401,
          'createMarginAnnotation'
        );
      }

      const result = await createMarginAnnotation(agent, {
        sourceUrl: input.sourceUrl,
        pageTitle: input.pageTitle,
        body: input.body,
        bodyFormat: input.bodyFormat,
        motivation: input.motivation,
        tags: input.tags,
      });

      return { annotationUri: result.uri, annotationCid: result.cid };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: marginKeys.annotations(variables.eprintUri),
      });
    },
  });
}

/**
 * Mutation hook for creating a Margin bookmark (dual-write from Chive bookmark).
 *
 * @returns Mutation object for creating bookmarks
 */
export function useCreateMarginBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      sourceUrl: string;
      title?: string;
      description?: string;
      tags?: string[];
    }): Promise<{ bookmarkUri: string; bookmarkCid: string }> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'createMarginBookmark');
      }

      const result = await createMarginBookmark(agent, input);
      return { bookmarkUri: result.uri, bookmarkCid: result.cid };
    },
  });
}

// =============================================================================
// REPAIR MIRROR HOOK
// =============================================================================

/**
 * Mutation hook for repairing an existing Cosmik mirror.
 *
 * @remarks
 * Reconciles the collection's `cosmikConnections` metadata with the actual
 * state of the graph: creates Cosmik connection records for inter-item
 * edges that should be mirrored but aren't, and deletes orphan connections
 * whose endpoints are no longer in the collection.
 *
 * Used to recover from pre-rigorous-integration mirrors that were created
 * without connections, and from drift introduced by partial-failure edge
 * operations.
 *
 * @returns Mutation object; input takes the collection URI, inter-item
 *   edges returned from the collection query, and the items currently in
 *   the collection.
 *
 * @public
 */
export function useRepairCosmikMirror() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      collectionUri: string;
      interItemEdges: Array<{
        edgeUri?: string;
        sourceUri: string;
        targetUri: string;
        relationSlug: string;
      }>;
      itemUrls: string[];
    }): Promise<{ created: number; pruned: number }> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'repairCosmikMirror');
      }

      const { syncEdgeToCosmik, deleteCosmikConnectionsForItem } =
        await import('@/lib/atproto/record-creator');

      let created = 0;
      for (const edge of input.interItemEdges) {
        if (!edge.edgeUri) continue;
        try {
          const mapping = await syncEdgeToCosmik(agent, 'create', {
            collectionUri: input.collectionUri,
            chiveEdgeUri: edge.edgeUri,
            chiveEdgeSourceUri: edge.sourceUri,
            chiveEdgeTargetUri: edge.targetUri,
            relationSlug: edge.relationSlug,
          });
          if (mapping) created++;
        } catch (err) {
          logger.warn('Repair: failed to sync edge', {
            edgeUri: edge.edgeUri,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Prune Cosmik connections whose endpoints are no longer in the
      // collection. We look up each connection record, check whether either
      // endpoint URL matches a current item, and delete if neither does.
      const itemUrlSet = new Set(input.itemUrls);
      const pruned = await pruneOrphanConnections(agent, input.collectionUri, itemUrlSet);

      return { created, pruned };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: collectionKeys.detail(variables.collectionUri),
      });
    },
  });
}

/**
 * Helper for `useRepairCosmikMirror`: deletes Cosmik connections whose
 * source and target are both absent from the current item set.
 *
 * @remarks
 * Reads the collection node's `cosmikConnections` metadata, fetches each
 * connection record to inspect its `source` and `target`, and deletes any
 * connection whose endpoints no longer correspond to items in the
 * collection. Updates the `cosmikConnections` metadata to reflect the
 * surviving set.
 *
 * @internal
 */
async function pruneOrphanConnections(
  agent: import('@atproto/api').Agent,
  collectionUri: string,
  itemUrlSet: Set<string>
): Promise<number> {
  const { loadEdgeSyncLookup, writeBackCosmikConnections, deleteCosmikConnection } =
    await import('@/lib/atproto/record-creator');

  const lookup = await loadEdgeSyncLookup(agent, collectionUri);
  if (!lookup) return 0;

  const did = (agent as unknown as { did?: string }).did;
  if (!did) return 0;

  const keep: Record<string, import('@/lib/atproto/record-creator').CosmikConnectionMapping> = {};
  const toDelete: import('@/lib/atproto/record-creator').CosmikConnectionMapping[] = [];

  for (const [key, mapping] of Object.entries(lookup.cosmikConnections)) {
    try {
      const parsed = parseAtUri(mapping.connectionUri);
      if (!parsed) {
        keep[key] = mapping;
        continue;
      }
      const response = await agent.com.atproto.repo.getRecord({
        repo: parsed.did,
        collection: 'network.cosmik.connection',
        rkey: parsed.rkey,
      });
      const record = response.data.value as {
        source?: string;
        target?: string;
      };
      if (
        (record.source && itemUrlSet.has(record.source)) ||
        (record.target && itemUrlSet.has(record.target))
      ) {
        keep[key] = mapping;
      } else {
        toDelete.push(mapping);
      }
    } catch {
      // Can't read the record — err on the side of keeping it.
      keep[key] = mapping;
    }
  }

  for (const mapping of toDelete) {
    try {
      await deleteCosmikConnection(agent, mapping.connectionUri);
    } catch (err) {
      logger.warn('Repair: failed to delete orphan connection', {
        connectionUri: mapping.connectionUri,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (toDelete.length > 0) {
    await writeBackCosmikConnections(agent, did, lookup.rkey, lookup.node, keep);
  }

  return toDelete.length;
}

/**
 * Minimal AT-URI parser used by the repair helper.
 *
 * @internal
 */
function parseAtUri(uri: string): { did: string; collection: string; rkey: string } | null {
  const match = /^at:\/\/([^/]+)\/([^/]+)\/(.+)$/.exec(uri);
  if (!match) return null;
  return { did: match[1]!, collection: match[2]!, rkey: match[3]! };
}
