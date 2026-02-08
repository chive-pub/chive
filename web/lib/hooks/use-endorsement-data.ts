/**
 * React hooks for fetching endorsement-related data from the knowledge graph.
 *
 * @remarks
 * Provides hooks for fetching endorsement types, endorsement kinds, and their
 * relationships to contribution types and each other.
 *
 * @packageDocumentation
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNodesBySubkind, useNode, type GraphNode } from './use-nodes';
import { api } from '../api/client';

/**
 * Endorsement type with related data.
 */
export interface EndorsementTypeData {
  /** Endorsement type node */
  node: GraphNode;
  /** Related endorsement kinds */
  kinds: GraphNode[];
  /** Related contribution types */
  contributionTypes: GraphNode[];
}

/**
 * Endorsement kind with related data.
 */
export interface EndorsementKindData {
  /** Endorsement kind node */
  node: GraphNode;
  /** Related endorsement types */
  types: GraphNode[];
}

/**
 * Category grouping endorsement types by kind.
 */
export interface EndorsementCategory {
  /** Category name (from endorsement kind label) */
  name: string;
  /** Endorsement kind node */
  kind: GraphNode;
  /** Endorsement types in this category */
  types: GraphNode[];
}

/**
 * Fetches all endorsement types from the knowledge graph.
 */
export function useEndorsementTypes() {
  return useNodesBySubkind('endorsement-type', { status: 'established' });
}

/**
 * Fetches all endorsement kinds from the knowledge graph.
 */
export function useEndorsementKinds() {
  return useNodesBySubkind('endorsement-kind', { status: 'established' });
}

/**
 * Fetches endorsement data grouped by category (endorsement kind).
 *
 * @returns Endorsement categories with types grouped by kind
 */
export function useEndorsementCategories() {
  const { data: typesData, isLoading: isTypesLoading } = useEndorsementTypes();
  const { data: kindsData, isLoading: isKindsLoading } = useEndorsementKinds();

  // Fetch edges for all endorsement types to find their kind relationships
  const { data: edgesData } = useQuery({
    queryKey: ['endorsement-type-kind-edges'],
    queryFn: async () => {
      if (!typesData?.nodes) {
        return { edges: [] };
      }

      // Fetch edges for each type node to find relates-to edges to kinds
      const allEdges: Array<{ sourceUri: string; targetUri: string }> = [];
      for (const type of typesData.nodes) {
        try {
          const response = await api.pub.chive.graph.listEdges({
            sourceUri: type.uri,
            relationSlug: 'relates-to',
            status: 'established',
            limit: 100,
          });
          if (response.data?.edges) {
            for (const edge of response.data.edges) {
              allEdges.push({ sourceUri: edge.sourceUri, targetUri: edge.targetUri });
            }
          }
        } catch {
          // Continue if edge query fails
        }
      }
      return { edges: allEdges };
    },
    enabled: !!typesData?.nodes && typesData.nodes.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  const isLoading = isTypesLoading || isKindsLoading;

  const data = useMemo(() => {
    if (!typesData?.nodes || !kindsData?.nodes) {
      return [];
    }

    const types = typesData.nodes;
    const kinds = kindsData.nodes;
    const edges = edgesData?.edges ?? [];

    // Create maps for quick lookup
    const kindMapByUri = new Map<string, GraphNode>();
    for (const kind of kinds) {
      kindMapByUri.set(kind.uri, kind);
    }

    const typeMapByUri = new Map<string, GraphNode>();
    for (const type of types) {
      typeMapByUri.set(type.uri, type);
    }

    // Group types by kind using edges
    const typesByKind = new Map<string, GraphNode[]>();
    for (const edge of edges) {
      const kind = kindMapByUri.get(edge.targetUri);
      const type = typeMapByUri.get(edge.sourceUri);
      if (kind && type) {
        const existing = typesByKind.get(kind.id) ?? [];
        if (!existing.find((t) => t.id === type.id)) {
          existing.push(type);
          typesByKind.set(kind.id, existing);
        }
      }
    }

    // Create categories sorted by kind displayOrder
    const categories: EndorsementCategory[] = [];
    const sortedKinds = [...kinds].sort((a, b) => {
      const orderA = a.metadata?.displayOrder ?? 999;
      const orderB = b.metadata?.displayOrder ?? 999;
      return orderA - orderB;
    });

    for (const kind of sortedKinds) {
      const relatedTypes = typesByKind.get(kind.id) ?? [];
      if (relatedTypes.length > 0) {
        // Sort types by displayOrder
        relatedTypes.sort((a, b) => {
          const orderA = a.metadata?.displayOrder ?? 999;
          const orderB = b.metadata?.displayOrder ?? 999;
          return orderA - orderB;
        });

        categories.push({
          name: kind.label,
          kind,
          types: relatedTypes,
        });
      }
    }

    // If no categories created (no edges), create one with all types sorted by displayOrder
    if (categories.length === 0 && types.length > 0) {
      const sortedTypes = [...types].sort((a, b) => {
        const orderA = a.metadata?.displayOrder ?? 999;
        const orderB = b.metadata?.displayOrder ?? 999;
        return orderA - orderB;
      });

      categories.push({
        name: 'All Endorsement Types',
        kind: kinds[0] ?? {
          id: 'default',
          uri: '',
          kind: 'type',
          subkind: 'endorsement-kind',
          label: 'Default',
          status: 'established',
          createdAt: '',
        },
        types: sortedTypes,
      });
    }

    return categories;
  }, [typesData, kindsData, edgesData]);

  return { data, isLoading };
}

/**
 * Fetches a single endorsement type with its related kinds and contribution types.
 *
 * @param typeId - Endorsement type node ID
 */
export function useEndorsementType(typeId: string) {
  const { data: typeNode } = useNode(typeId, { includeRelated: true });

  return useMemo(() => {
    if (!typeNode) {
      return null;
    }

    // Extract related nodes from the node detail
    const kinds: GraphNode[] = [];
    const contributionTypes: GraphNode[] = [];

    // In a full implementation, we'd parse the related edges
    // For now, return the basic structure
    return {
      node: typeNode,
      kinds,
      contributionTypes,
    } as EndorsementTypeData;
  }, [typeNode]);
}
