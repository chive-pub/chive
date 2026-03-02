import { KnowledgeGraphViewer } from '@/components/knowledge-graph';

/**
 * Knowledge Graph exploration page.
 *
 * @remarks
 * Comprehensive viewer for exploring the unified knowledge graph.
 * Displays nodes organized by subkind (fields, facets, institutions, etc.)
 * with search, filtering, and navigation capabilities.
 * Node click interactions are handled internally via the KnowledgeGraphViewer's
 * NodeDetailModal.
 */
export default function GraphPage() {
  return (
    <div className="container py-8">
      <KnowledgeGraphViewer />
    </div>
  );
}
