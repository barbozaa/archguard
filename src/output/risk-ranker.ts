import { Violation } from '../core/types.js';

/**
 * Ranks violations by severity and impact
 */
export class RiskRanker {
  rank(violations: Violation[], topN: number = 5): Violation[] {
    // Sort by severity first, then by penalty
    const sorted = [...violations].sort((a, b) => {
      // Critical > Warning > Info
      const severityOrder = { critical: 3, warning: 2, info: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      
      if (severityDiff !== 0) {
        return severityDiff;
      }

      // Then by penalty
      return b.penalty - a.penalty;
    });

    return sorted.slice(0, topN);
  }

  countBySeverity(violations: Violation[]): {
    critical: number;
    warning: number;
    info: number;
  } {
    return violations.reduce(
      (acc, v) => {
        acc[v.severity]++;
        return acc;
      },
      { critical: 0, warning: 0, info: 0 }
    );
  }
}
