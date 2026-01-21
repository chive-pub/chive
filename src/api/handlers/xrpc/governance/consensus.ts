/**
 * Consensus calculation utilities for governance proposals.
 *
 * @packageDocumentation
 * @public
 */

import type { ConsensusProgress } from '../../../../lexicons/generated/types/pub/chive/governance/getProposal.js';

/**
 * Consensus calculation constants.
 */
const CONSENSUS_THRESHOLD = 0.67; // 67% weighted approval required
const MINIMUM_VOTES = 3; // Minimum votes needed for consensus

/**
 * Calculate consensus progress from vote counts.
 *
 * @param votes - Vote counts (approve, reject, abstain)
 * @returns Consensus progress object
 *
 * @public
 */
export function calculateConsensus(votes: {
  approve: number;
  reject: number;
  abstain: number;
}): ConsensusProgress {
  const totalVotes = votes.approve + votes.reject + votes.abstain;
  const decisiveVotes = votes.approve + votes.reject;

  // Calculate approval percentage (excluding abstains from denominator)
  const approvalPercentage = decisiveVotes > 0 ? votes.approve / decisiveVotes : 0;

  const hasMinimumVotes = totalVotes >= MINIMUM_VOTES;
  const meetsThreshold = approvalPercentage >= CONSENSUS_THRESHOLD;
  const consensusReached = hasMinimumVotes && meetsThreshold;

  // Determine recommended status
  let recommendedStatus: 'approved' | 'rejected' | 'pending' = 'pending';
  if (hasMinimumVotes) {
    if (meetsThreshold) {
      recommendedStatus = 'approved';
    } else if (approvalPercentage < 1 - CONSENSUS_THRESHOLD) {
      recommendedStatus = 'rejected';
    }
  }

  return {
    approvalPercentage: Math.round(approvalPercentage * 100),
    threshold: Math.round(CONSENSUS_THRESHOLD * 100),
    voterCount: totalVotes,
    minimumVotes: MINIMUM_VOTES,
    consensusReached,
    recommendedStatus,
  };
}
