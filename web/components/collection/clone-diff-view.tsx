'use client';

/**
 * Diff view for clone subgraph results, showing successes and failures.
 *
 * @remarks
 * Displayed after a graph clone mutation completes. Groups results into
 * two sections: successfully cloned nodes (green) and failed nodes that
 * fell back to community references (amber). Failed nodes can be retried
 * individually.
 *
 * @packageDocumentation
 */

import { Check, AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { CloneSubgraphResult, FailedCloneNode } from '@/lib/hooks/use-graph-clone';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for CloneDiffView.
 */
export interface CloneDiffViewProps {
  /** The result from the clone subgraph mutation */
  result: CloneSubgraphResult;
  /** Called when user retries a failed node */
  onRetry?: (uri: string) => void;
  /** Called when user clicks "Continue to collection" */
  onContinue?: () => void;
}

// =============================================================================
// SUBCOMPONENTS
// =============================================================================

/**
 * Renders the success summary section.
 */
function SuccessSection({ clonedNodes }: { clonedNodes: number }) {
  if (clonedNodes === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-green-700">
        <Check className="h-5 w-5 shrink-0" />
        <h3 className="text-sm font-semibold">Cloned to personal graph</h3>
      </div>
      <div className="rounded-md border border-green-200 bg-green-50 p-3">
        <p className="text-sm text-green-800">
          {clonedNodes} node{clonedNodes !== 1 ? 's' : ''} successfully cloned to your personal
          graph.
        </p>
      </div>
    </div>
  );
}

/**
 * Renders a single failed node row with label, reason, and retry button.
 */
function FailedNodeRow({
  node,
  onRetry,
}: {
  node: FailedCloneNode;
  onRetry?: (uri: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium text-amber-900 truncate">{node.label}</p>
        <p className="text-xs text-amber-700">{node.reason}</p>
      </div>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1 text-amber-700 border-amber-300 hover:bg-amber-100"
          onClick={() => onRetry(node.uri)}
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </Button>
      )}
    </div>
  );
}

/**
 * Renders the failure section listing each failed node.
 */
function FailureSection({
  failedNodes,
  onRetry,
}: {
  failedNodes: FailedCloneNode[];
  onRetry?: (uri: string) => void;
}) {
  if (failedNodes.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-amber-700">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <h3 className="text-sm font-semibold">Fallback to community</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        These nodes could not be cloned to your personal graph. They will reference the community
        version instead.
      </p>
      <ScrollArea className="max-h-[300px]">
        <div className="space-y-2 pr-4">
          {failedNodes.map((node) => (
            <FailedNodeRow key={node.uri} node={node} onRetry={onRetry} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Shows the result of a graph clone operation as a success/failure diff.
 *
 * @param props - Component props
 * @returns Diff view element
 */
export function CloneDiffView({ result, onRetry, onContinue }: CloneDiffViewProps) {
  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div>
          <h2 className="text-lg font-semibold">Clone Results</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your collection has been created. Below is a summary of which nodes were cloned
            successfully and which fell back to community references.
          </p>
        </div>

        <SuccessSection clonedNodes={result.clonedNodes} />
        <FailureSection failedNodes={result.failedNodes} onRetry={onRetry} />

        {onContinue && (
          <div className="flex justify-end pt-2 border-t">
            <Button type="button" onClick={onContinue}>
              Continue to collection
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
