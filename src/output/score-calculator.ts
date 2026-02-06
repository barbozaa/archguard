import { Violation, HealthStatus, ScoreBreakdown } from '@core/types.js';
import { PenaltyCalculator } from './penalty-calculator.js';

/**
 * Calculates architecture health score based on violations with weighted categories
 */
export class ScoreCalculator {
  private static readonly STARTING_SCORE = 100;
  private static readonly MIN_SCORE = 0;
  private static readonly MAX_SCORE = 100;

  private readonly penaltyCalculator = new PenaltyCalculator();

  calculate(
    violations: Violation[], 
    totalModules: number,
    totalLOC?: number
  ): {
    score: number;
    architectureScore: number;
    hygieneScore: number;
    status: HealthStatus;
    breakdown?: ScoreBreakdown;
  } {
    // Use weighted penalty calculation if LOC available
    if (totalLOC && totalLOC > 0) {
      const breakdown = this.penaltyCalculator.calculatePenalty(violations, totalLOC);
      
      // Architecture Health Score (excludes hygiene)
      const rawArchitectureScore = ScoreCalculator.STARTING_SCORE - breakdown.architecturePenalty;
      const architectureScore = Math.max(
        ScoreCalculator.MIN_SCORE,
        Math.min(ScoreCalculator.MAX_SCORE, Math.round(rawArchitectureScore))
      );
      
      // Hygiene Score (separate)
      const rawHygieneScore = ScoreCalculator.STARTING_SCORE - breakdown.hygienePenalty;
      const hygieneScore = Math.max(
        ScoreCalculator.MIN_SCORE,
        Math.min(ScoreCalculator.MAX_SCORE, Math.round(rawHygieneScore))
      );
      
      // Overall score (for backward compatibility) - weighted combination
      const score = Math.round(architectureScore * 0.9 + hygieneScore * 0.1);
      const status = this.getStatus(architectureScore); // Status based on architecture score

      return { score, architectureScore, hygieneScore, status, breakdown };
    }

    // Fallback to legacy calculation for backward compatibility
    return this.calculateLegacy(violations, totalModules);
  }

  private calculateLegacy(violations: Violation[], totalModules: number): {
    score: number;
    architectureScore: number;
    hygieneScore: number;
    status: HealthStatus;
  } {
    let totalPenalty = 0;

    // Calculate total penalty
    for (const violation of violations) {
      totalPenalty += violation.penalty;
    }

    // Improved scaling algorithm
    const scalingFactor = this.calculateScalingFactor(totalModules, violations.length);
    const adjustedPenalty = totalPenalty / scalingFactor;

    // Calculate final score
    const score = Math.max(ScoreCalculator.MIN_SCORE, Math.round(ScoreCalculator.STARTING_SCORE - adjustedPenalty));
    const architectureScore = score; // Same as overall in legacy mode
    const hygieneScore = score; // Same as overall in legacy mode

    // Determine status
    const status = this.getStatus(score);

    return { score, architectureScore, hygieneScore, status };
  }

  private calculateScalingFactor(totalModules: number, violationCount: number): number {
    // Base scaling: smaller projects get more help
    let baseScaling = 1;
    
    if (totalModules <= 100) {  // Increased from 50 to 100 for small projects
      // Small projects: scale penalties down significantly
      // Formula: 1 + (violations / modules) * 2
      // More violations relative to module count = more scaling help
      const violationRatio = violationCount / Math.max(1, totalModules);
      baseScaling = 1 + Math.min(violationRatio * 2, 8); // Cap at 9x
    } else if (totalModules <= 200) {
      // Medium projects: moderate scaling
      baseScaling = totalModules / 50;
    } else {
      // Large projects: minimal additional scaling
      baseScaling = 4 + (totalModules - 200) / 100;
    }

    return Math.max(1, baseScaling);
  }

  private getStatus(score: number): HealthStatus {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Healthy';
    if (score >= 60) return 'Needs Attention';
    return 'Critical';
  }

  getGrade(score: number): string {
    if (score >= 90) return 'EXCELLENT';
    if (score >= 75) return 'GOOD';
    if (score >= 60) return 'FAIR';
    if (score >= 40) return 'POOR';
    return 'CRITICAL';
  }
}
