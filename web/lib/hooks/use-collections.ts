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

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { APIError } from '@/lib/errors';
import { authApi, getApiBaseUrl } from '@/lib/api/client';
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
  reorderCollectionItems,
  createSembleMirror,
  type CreateCollectionNodeInput,
  type UpdateCollectionNodeInput,
  type AddItemToCollectionInput,
  type AddSubcollectionInput,
  type MoveSubcollectionInput,
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
  name: string;
  description?: string;
  visibility: 'public' | 'unlisted' | 'private';
  itemCount: number;
  tags?: string[];
  parentCollectionUri?: string;
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
}

/**
 * Response from searching collections.
 */
export interface SearchCollectionsResponse {
  collections: CollectionView[];
  cursor?: string;
  total?: number;
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
 *   console.log(data.collection.name, data.items.length);
 * }
 * ```
 */
export function useCollection(uri: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: collectionKeys.detail(uri),
    queryFn: async (): Promise<CollectionDetailResponse> => {
      try {
        const baseUrl = getApiBaseUrl();
        const searchParams = new URLSearchParams({ uri });
        const url = `${baseUrl}/xrpc/pub.chive.collection.get?${searchParams.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
          throw new APIError(
            typeof body['message'] === 'string' ? body['message'] : 'Failed to fetch collection',
            response.status,
            'pub.chive.collection.get'
          );
        }
        return (await response.json()) as CollectionDetailResponse;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch collection',
          undefined,
          'pub.chive.collection.get'
        );
      }
    },
    enabled: !!uri && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000,
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
      try {
        const baseUrl = getApiBaseUrl();
        const searchParams = new URLSearchParams({ did, limit: '100' });
        const url = `${baseUrl}/xrpc/pub.chive.collection.listByOwner?${searchParams.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
          throw new APIError(
            typeof body['message'] === 'string' ? body['message'] : 'Failed to fetch collections',
            response.status,
            'pub.chive.collection.listByOwner'
          );
        }
        return (await response.json()) as ListCollectionsResponse;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch collections',
          undefined,
          'pub.chive.collection.listByOwner'
        );
      }
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
      try {
        const baseUrl = getApiBaseUrl();
        const searchParams = new URLSearchParams({
          visibility: 'public',
          limit: String(options?.limit ?? 20),
        });
        if (options?.tag) {
          searchParams.set('tag', options.tag);
        }
        const url = `${baseUrl}/xrpc/pub.chive.collection.listPublic?${searchParams.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
          throw new APIError(
            typeof body['message'] === 'string'
              ? body['message']
              : 'Failed to fetch public collections',
            response.status,
            'pub.chive.collection.listPublic'
          );
        }
        return (await response.json()) as ListCollectionsResponse;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch public collections',
          undefined,
          'pub.chive.collection.listPublic'
        );
      }
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
      try {
        const baseUrl = getApiBaseUrl();
        const searchParams = new URLSearchParams({ itemUri });
        const url = `${baseUrl}/xrpc/pub.chive.collection.getContaining?${searchParams.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
          throw new APIError(
            typeof body['message'] === 'string' ? body['message'] : 'Failed to fetch collections',
            response.status,
            'pub.chive.collection.getContaining'
          );
        }
        return (await response.json()) as ListCollectionsResponse;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch collections containing item',
          undefined,
          'pub.chive.collection.getContaining'
        );
      }
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
      try {
        const baseUrl = getApiBaseUrl();
        const searchParams = new URLSearchParams({ query, limit: '20' });
        const url = `${baseUrl}/xrpc/pub.chive.collection.search?${searchParams.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
          throw new APIError(
            typeof body['message'] === 'string' ? body['message'] : 'Failed to search collections',
            response.status,
            'pub.chive.collection.search'
          );
        }
        return (await response.json()) as SearchCollectionsResponse;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to search collections',
          undefined,
          'pub.chive.collection.search'
        );
      }
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
      try {
        const baseUrl = getApiBaseUrl();
        const searchParams = new URLSearchParams({ parentUri: uri });
        const url = `${baseUrl}/xrpc/pub.chive.collection.getSubcollections?${searchParams.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
          throw new APIError(
            typeof body['message'] === 'string'
              ? body['message']
              : 'Failed to fetch subcollections',
            response.status,
            'pub.chive.collection.getSubcollections'
          );
        }
        return (await response.json()) as ListCollectionsResponse;
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch subcollections',
          undefined,
          'pub.chive.collection.getSubcollections'
        );
      }
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
        const baseUrl = getApiBaseUrl();
        const searchParams = new URLSearchParams({ uri });
        const url = `${baseUrl}/xrpc/pub.chive.collection.getParent?${searchParams.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
          if (response.status === 404) return null;
          const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
          throw new APIError(
            typeof body['message'] === 'string'
              ? body['message']
              : 'Failed to fetch parent collection',
            response.status,
            'pub.chive.collection.getParent'
          );
        }
        return (await response.json()) as CollectionView;
      } catch (error) {
        if (error instanceof APIError) {
          if (error.statusCode === 404) return null;
          throw error;
        }
        throw new APIError(
          error instanceof Error ? error.message : 'Failed to fetch parent collection',
          undefined,
          'pub.chive.collection.getParent'
        );
      }
    },
    enabled: !!uri && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000,
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
 * Semble mirror creation when enableSembleMirror is true.
 */
export interface CreateCollectionMutationInput extends CreateCollectionNodeInput {
  /** Items to mirror as Semble cards when enableSembleMirror is true */
  items?: Array<{
    /** URL or AT-URI of the item */
    uri: string;
    /** Display label */
    label: string;
    /** Optional annotation note */
    note?: string;
  }>;
}

/**
 * Mutation hook for creating a new collection.
 *
 * @remarks
 * Creates a collection node in the user's PDS and requests immediate
 * indexing for UI responsiveness. When enableSembleMirror is true and
 * items are provided, also creates companion xyz.semble.card and
 * xyz.semble.collection records for cross-ecosystem discovery.
 *
 * @example
 * ```tsx
 * const createCollection = useCreateCollection();
 *
 * const handleCreate = async () => {
 *   await createCollection.mutateAsync({
 *     name: 'My Reading List',
 *     visibility: 'public',
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

      // Create Semble mirror if enabled and items are provided
      if (input.enableSembleMirror && input.items && input.items.length > 0) {
        try {
          await createSembleMirror(agent, {
            collectionUri: result.uri,
            title: input.name,
            description: input.description,
            visibility: input.visibility,
            items: input.items.map((item) => ({
              url: item.uri,
              title: item.label,
              note: item.note,
            })),
          });
        } catch (sembleError) {
          logger.warn('Semble mirror creation failed; collection was created without mirror', {
            uri: result.uri,
            error: sembleError instanceof Error ? sembleError.message : String(sembleError),
          });
        }
      }

      return {
        uri: result.uri,
        cid: result.cid,
        ownerDid: agent.did ?? '',
        name: input.name,
        description: input.description,
        visibility: input.visibility,
        itemCount: 0,
        tags: input.tags,
        createdAt: new Date().toISOString(),
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
      input: UpdateCollectionNodeInput & { ownerDid: string }
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

      return {
        uri: result.uri,
        cid: result.cid,
        ownerDid: input.ownerDid,
        name: input.name ?? '',
        description: input.description,
        visibility: input.visibility ?? 'public',
        itemCount: 0,
        tags: input.tags,
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
    }: {
      uri: string;
      ownerDid: string;
      cascadeSubcollections?: boolean;
    }): Promise<void> => {
      const agent = getCurrentAgent();
      if (!agent) {
        throw new APIError('Not authenticated. Please log in again.', 401, 'deleteCollection');
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
      queryClient.invalidateQueries({
        queryKey: collectionKeys.detail(variables.uri),
      });
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
    mutationFn: async (input: AddItemToCollectionInput): Promise<{ edgeUri: string }> => {
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
 * Mutation hook for removing an item from a collection.
 *
 * @returns Mutation object for removing items
 */
export function useRemoveFromCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      edgeUri,
    }: {
      edgeUri: string;
      collectionUri: string;
      itemUri: string;
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
    onSuccess: (_, variables) => {
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
