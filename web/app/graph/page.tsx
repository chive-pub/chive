'use client';

import { useRouter } from 'next/navigation';

import { KnowledgeGraphViewer, type GraphNode } from '@/components/knowledge-graph';

/**
 * Knowledge Graph exploration page.
 *
 * @remarks
 * Comprehensive viewer for exploring the unified knowledge graph.
 * Displays nodes organized by subkind (fields, facets, institutions, etc.)
 * with search, filtering, and navigation capabilities.
 */
export default function GraphPage() {
  const router = useRouter();

  const handleNodeSelect = (node: GraphNode) => {
    // Navigate to appropriate detail page based on subkind
    if (node.subkind === 'field') {
      router.push(`/fields/${node.id}`);
    }
    // Other subkinds can be handled as pages are created
  };

  return (
    <div className="container py-8">
      <KnowledgeGraphViewer onNodeSelect={handleNodeSelect} />
    </div>
  );
}
