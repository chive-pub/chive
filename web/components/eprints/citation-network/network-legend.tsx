'use client';

/**
 * The key to the citation network's colours.
 *
 * @remarks
 * The graph encodes two things in colour at once -- what a paper is to the
 * paper being read against, and which of the two anchors that was -- and
 * neither is guessable. A key is not decoration here.
 *
 * @packageDocumentation
 */

import { roleStyle, type NodeRelation, type Tier } from '@/lib/citations/network-model';

/** One row of the key. */
function Key({ relation, tier, label }: { relation: NodeRelation; tier: Tier; label: string }) {
  const style = roleStyle({ relation, tier });
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border"
        style={{ background: style.fill, borderColor: style.stroke }}
      />
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  );
}

/** Props for {@link NetworkLegend}. */
export interface NetworkLegendProps {
  /** Whether a second paper is currently selected. */
  readonly hasSelection: boolean;
}

/**
 * Renders the key.
 *
 * @param props - Component props
 * @returns The key
 *
 * @public
 */
export function NetworkLegend({ hasSelection }: NetworkLegendProps) {
  return (
    <div className="rounded-lg border bg-card/95 p-2.5 backdrop-blur">
      <div className="flex flex-col gap-1.5">
        {/* Grouped under the paper each colour is read against, and worded with
            an explicit subject. "Cited by it" is ambiguous about which way the
            citation runs, which is the one thing these colours encode. */}
        <Key relation="anchor" tier="primary" label="This paper" />
        <Key relation="citer" tier="primary" label="Papers citing it" />
        <Key relation="reference" tier="primary" label="Papers it cites" />
        {hasSelection && (
          <>
            <span className="my-0.5 border-t" />
            <Key relation="anchor" tier="secondary" label="Selected paper" />
            <Key relation="citer" tier="secondary" label="Papers citing it" />
            <Key relation="reference" tier="secondary" label="Papers it cites" />
          </>
        )}
      </div>
    </div>
  );
}
