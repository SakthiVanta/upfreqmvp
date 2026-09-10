/**
 * Pareto Multi-Metric Evaluation Engine
 * Evaluates candidate code/parameter proposals against multi-objective Pareto frontiers:
 * - Safety (collision count, obstacle clearance margin)
 * - Throughput (average velocity, time to goal)
 * - Path Smoothness (jerk, acceleration variance)
 */

export interface ParetoMetrics {
  collisionCount: number;
  minObstacleClearanceM: number;
  avgTimeToGoalSec: number;
  pathSmoothnessScore: number; // 0 to 1.0 (higher is smoother)
  trialsPassed: number;
  trialsTotal: number;
}

export interface ParetoEvaluationDecision {
  outcome: 'ACCEPT' | 'REJECT' | 'PENDING_REVIEW';
  dominantCandidate: 'candidate' | 'baseline' | 'tradeoff';
  rationale: string;
  safetyPassed: boolean;
  throughputDeltaPercent: number;
  clearanceDeltaPercent: number;
  smoothnessDeltaPercent: number;
  frontierImprovement: boolean;
}

export function evaluateParetoFrontier(
  baseline: ParetoMetrics,
  candidate: ParetoMetrics
): ParetoEvaluationDecision {
  // 1. Safety is a hard invariant
  const safetyPassed = candidate.collisionCount === 0;
  if (!safetyPassed) {
    return {
      outcome: 'REJECT',
      dominantCandidate: 'baseline',
      rationale: `Safety violation: Candidate produced ${candidate.collisionCount} collision(s). Automatic rejection.`,
      safetyPassed: false,
      throughputDeltaPercent: 0,
      clearanceDeltaPercent: 0,
      smoothnessDeltaPercent: 0,
      frontierImprovement: false,
    };
  }

  // Calculate percentage improvements
  // Throughput: lower time to goal is better
  const throughputDelta = baseline.avgTimeToGoalSec > 0
    ? ((baseline.avgTimeToGoalSec - candidate.avgTimeToGoalSec) / baseline.avgTimeToGoalSec) * 100
    : 0;

  // Clearance: higher clearance is safer
  const clearanceDelta = baseline.minObstacleClearanceM > 0
    ? ((candidate.minObstacleClearanceM - baseline.minObstacleClearanceM) / baseline.minObstacleClearanceM) * 100
    : 0;

  // Smoothness: higher is better
  const smoothnessDelta = baseline.pathSmoothnessScore > 0
    ? ((candidate.pathSmoothnessScore - baseline.pathSmoothnessScore) / baseline.pathSmoothnessScore) * 100
    : 0;

  // Decision logic:
  // Candidate dominates if throughput is better/equal AND clearance is not severely degraded (> -5%)
  const isThroughputBetter = throughputDelta > 0.5;
  const isClearanceAcceptable = clearanceDelta >= -5.0;
  const isSmoothnessBetter = smoothnessDelta >= -1.0;

  if (isThroughputBetter && isClearanceAcceptable && isSmoothnessBetter) {
    return {
      outcome: 'ACCEPT',
      dominantCandidate: 'candidate',
      rationale: `Pareto frontier improved: Time to goal reduced by ${throughputDelta.toFixed(1)}% with zero collisions and safe clearance (${candidate.minObstacleClearanceM.toFixed(2)}m).`,
      safetyPassed: true,
      throughputDeltaPercent: parseFloat(throughputDelta.toFixed(2)),
      clearanceDeltaPercent: parseFloat(clearanceDelta.toFixed(2)),
      smoothnessDeltaPercent: parseFloat(smoothnessDelta.toFixed(2)),
      frontierImprovement: true,
    };
  }

  if (throughputDelta < -5.0) {
    return {
      outcome: 'REJECT',
      dominantCandidate: 'baseline',
      rationale: `Performance regression: Candidate increased average time to goal by ${Math.abs(throughputDelta).toFixed(1)}%.`,
      safetyPassed: true,
      throughputDeltaPercent: parseFloat(throughputDelta.toFixed(2)),
      clearanceDeltaPercent: parseFloat(clearanceDelta.toFixed(2)),
      smoothnessDeltaPercent: parseFloat(smoothnessDelta.toFixed(2)),
      frontierImprovement: false,
    };
  }

  // Mixed trade-off
  return {
    outcome: 'PENDING_REVIEW',
    dominantCandidate: 'tradeoff',
    rationale: `Trade-off requires engineer review: Throughput delta: ${throughputDelta.toFixed(1)}%, Clearance delta: ${clearanceDelta.toFixed(1)}%.`,
    safetyPassed: true,
    throughputDeltaPercent: parseFloat(throughputDelta.toFixed(2)),
    clearanceDeltaPercent: parseFloat(clearanceDelta.toFixed(2)),
    smoothnessDeltaPercent: parseFloat(smoothnessDelta.toFixed(2)),
    frontierImprovement: false,
  };
}
