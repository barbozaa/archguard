import { Violation, Severity, CategoryScore, ScoreBreakdown } from '@domain/types.js';

/**
 * Rule category for architectural classification
 */
export type RuleCategory = 'structural' | 'design' | 'hygiene';

export interface CategoryConfig {
  multiplier: number;
  weight: number;
}

export interface RuleMetadata {
  name: string;
  weight: number;
  category: RuleCategory;
}

/**
 * Calculates category-specific penalties with weights and normalization.
 *
 * Score model:
 *   Architecture Health = 100 - (structural*0.50 + design*0.35 + hygiene*0.15) normalized by LOC
 *   Hygiene Score       = 100 - hygiene penalty normalized by LOC
 */
export class PenaltyCalculator {
  // Baseline matches the small-project threshold so penalties only *decrease*
  // for projects larger than the threshold, never increase.
  private static readonly BASELINE_PROJECT_SIZE = 5000;
  private static readonly SMALL_PROJECT_THRESHOLD = 5000;
  private static readonly MEDIUM_PROJECT_THRESHOLD = 50000;
  private static readonly LARGE_PROJECT_THRESHOLD = 200000;
  private static readonly NORMALIZATION_POWER_SMALL = 0.3;
  private static readonly NORMALIZATION_POWER_MEDIUM = 0.4;
  private static readonly NORMALIZATION_POWER_LARGE = 0.5;
  private static readonly MIN_LOC_FOR_NORMALIZATION = 1;

  private static readonly HIGH_IMPACT_THRESHOLD = 50;
  private static readonly MEDIUM_IMPACT_THRESHOLD = 20;
  private static readonly TOP_ISSUES_LIMIT = 5;

  // Weights sum to 1.0 across structural + design + hygiene
  private readonly categoryWeights: Record<RuleCategory, number> = {
    structural: 0.50,
    design: 0.35,
    hygiene: 0.15,
  };

  private readonly categoryMultipliers: Record<RuleCategory, number> = {
    structural: 1.2,
    design: 1.0,
    hygiene: 0.5,
  };

  private readonly severityMultipliers: Record<Severity, number> = {
    critical: 1.0,
    warning: 0.6,
    info: 0.3,
  };

  private readonly ruleMetadata: Map<string, RuleMetadata> = new Map([
    // === STRUCTURAL ARCHITECTURE ===
    ['layer-violation', { name: 'layer-violation', weight: 10, category: 'structural' }],

    // === COUPLING & DESIGN ===
    ['too-many-imports', { name: 'too-many-imports', weight: 7, category: 'design' }],
    ['shotgun-surgery', { name: 'shotgun-surgery', weight: 7, category: 'design' }],
    ['data-clumps', { name: 'data-clumps', weight: 6, category: 'design' }],

    // === CODE HEALTH / HYGIENE ===
    ['duplicate-code', { name: 'duplicate-code', weight: 6, category: 'hygiene' }],
  ]);

  calculatePenalty(violations: Violation[], totalLOC: number): ScoreBreakdown {
    if (totalLOC < PenaltyCalculator.MIN_LOC_FOR_NORMALIZATION) {
      throw new Error(`Invalid totalLOC: ${totalLOC}. Must be at least ${PenaltyCalculator.MIN_LOC_FOR_NORMALIZATION}`);
    }

    const categorized = this.categorizeViolations(violations);

    const structural = this.calculateCategoryPenalty(categorized.structural, 'structural');
    const design = this.calculateCategoryPenalty(categorized.design, 'design');
    const hygiene = this.calculateCategoryPenalty(categorized.hygiene, 'hygiene');

    // Complexity category no longer exists — use a zero placeholder for ScoreBreakdown compatibility
    const complexity: CategoryScore = {
      violations: 0,
      penalty: 0,
      weight: 0,
      impact: 'LOW',
      topIssues: [],
    };

    const architecturePenalty =
      structural.penalty * this.categoryWeights.structural +
      design.penalty * this.categoryWeights.design;

    const totalPenalty = architecturePenalty + hygiene.penalty * this.categoryWeights.hygiene;

    const normalizedArchitecturePenalty = this.normalizePenalty(architecturePenalty, totalLOC);
    // Hygiene penalty is normalized directly — the categoryWeight (0.15) is
    // already captured by the low categoryMultiplier (0.5). Adding a third
    // multiplier of 0.15 would make hygiene effectively invisible on the score.
    const normalizedHygienePenalty = this.normalizePenalty(hygiene.penalty, totalLOC);
    const normalizedPenalty = normalizedArchitecturePenalty + normalizedHygienePenalty;

    return {
      structural,
      design,
      complexity,
      hygiene,
      totalPenalty,
      normalizedPenalty,
      architecturePenalty: normalizedArchitecturePenalty,
      hygienePenalty: normalizedHygienePenalty,
    };
  }

  private categorizeViolations(violations: Violation[]): Record<RuleCategory, Violation[]> {
    const result: Record<RuleCategory, Violation[]> = {
      structural: [],
      design: [],
      hygiene: [],
    };

    for (const violation of violations) {
      const metadata = this.getRuleMetadata(violation.rule);
      const category = metadata?.category ?? 'hygiene';
      result[category].push(violation);
    }

    return result;
  }

  private calculateCategoryPenalty(violations: Violation[], category: RuleCategory): CategoryScore {
    let penalty = 0;

    for (const violation of violations) {
      const metadata = this.getRuleMetadata(violation.rule);
      const weight = metadata?.weight ?? 1;
      const severityMultiplier = this.severityMultipliers[violation.severity];
      const categoryMultiplier = this.categoryMultipliers[category];
      penalty += weight * severityMultiplier * categoryMultiplier;
    }

    const topIssues = [...violations]
      .sort((a, b) => {
        const weightA = this.getRuleMetadata(a.rule)?.weight ?? 1;
        const weightB = this.getRuleMetadata(b.rule)?.weight ?? 1;
        return weightB - weightA;
      })
      .slice(0, PenaltyCalculator.TOP_ISSUES_LIMIT);

    return {
      violations: violations.length,
      penalty: Math.round(penalty * 10) / 10,
      weight: this.categoryMultipliers[category],
      impact: this.getImpactLevel(penalty),
      topIssues,
    };
  }

  private normalizePenalty(penalty: number, totalLOC: number): number {
    if (totalLOC <= PenaltyCalculator.SMALL_PROJECT_THRESHOLD) {
      return penalty;
    }

    const baselineSize = PenaltyCalculator.BASELINE_PROJECT_SIZE;
    let powerFactor: number;

    if (totalLOC <= PenaltyCalculator.MEDIUM_PROJECT_THRESHOLD) {
      powerFactor = PenaltyCalculator.NORMALIZATION_POWER_SMALL;
    } else if (totalLOC <= PenaltyCalculator.LARGE_PROJECT_THRESHOLD) {
      powerFactor = PenaltyCalculator.NORMALIZATION_POWER_MEDIUM;
    } else {
      powerFactor = PenaltyCalculator.NORMALIZATION_POWER_LARGE;
    }

    return penalty * Math.pow(baselineSize / totalLOC, powerFactor);
  }

  private getRuleMetadata(ruleName: string): RuleMetadata | undefined {
    return this.ruleMetadata.get(ruleName.toLowerCase().replace(/\s+/g, '-'));
  }

  private getImpactLevel(penalty: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (penalty >= PenaltyCalculator.HIGH_IMPACT_THRESHOLD) return 'HIGH';
    if (penalty >= PenaltyCalculator.MEDIUM_IMPACT_THRESHOLD) return 'MEDIUM';
    return 'LOW';
  }

  getRuleMetadataMap(): Map<string, RuleMetadata> {
    return new Map(this.ruleMetadata);
  }

  getCategoryMultiplier(category: RuleCategory): number {
    return this.categoryMultipliers[category];
  }
}
