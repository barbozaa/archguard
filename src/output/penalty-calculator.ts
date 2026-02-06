import { Violation, Severity, CategoryScore, ScoreBreakdown } from '@core/types.js';

/**
 * Rule category for architectural classification
 */
export type RuleCategory = 'structural' | 'design' | 'complexity' | 'hygiene';

/**
 * Category-specific penalty configuration
 */
export interface CategoryConfig {
  multiplier: number;
  weight: number;
}

/**
 * Rule metadata for weighted scoring
 */
export interface RuleMetadata {
  name: string;
  weight: number;
  category: RuleCategory;
}

/**
 * Calculates category-specific penalties with weights and normalization
 */
export class PenaltyCalculator {
  // Normalization configuration
  private static readonly BASELINE_PROJECT_SIZE = 10000;
  private static readonly SMALL_PROJECT_THRESHOLD = 5000;
  private static readonly MEDIUM_PROJECT_THRESHOLD = 50000;
  private static readonly LARGE_PROJECT_THRESHOLD = 200000;
  private static readonly NORMALIZATION_POWER_SMALL = 0.3;
  private static readonly NORMALIZATION_POWER_MEDIUM = 0.4;
  private static readonly NORMALIZATION_POWER_LARGE = 0.5;
  private static readonly MIN_LOC_FOR_NORMALIZATION = 1;

  // Impact thresholds
  private static readonly HIGH_IMPACT_THRESHOLD = 50;
  private static readonly MEDIUM_IMPACT_THRESHOLD = 20;
  private static readonly TOP_ISSUES_LIMIT = 5;

  // Category weights for Architecture Health Score:
  // Structural: 40%, Design: 30%, Complexity: 20%, Hygiene: 10%
  private readonly categoryWeights: Record<RuleCategory, number> = {
    structural: 0.40,
    design: 0.30,
    complexity: 0.20,
    hygiene: 0.10,
  };

  private readonly categoryMultipliers: Record<RuleCategory, number> = {
    structural: 1.2,
    design: 1.0,
    complexity: 0.8,
    hygiene: 0.5,
  };

  private readonly severityMultipliers: Record<Severity, number> = {
    critical: 1.0,
    warning: 0.6,
    info: 0.3,
  };

  private readonly ruleMetadata: Map<string, RuleMetadata> = new Map([
    // === CORE ARCHITECTURE RULES (Structural) ===
    ['circular-deps', { name: 'circular-deps', weight: 10, category: 'structural' }],
    ['layer-violation', { name: 'layer-violation', weight: 9, category: 'structural' }],
    ['forbidden-imports', { name: 'forbidden-imports', weight: 8, category: 'structural' }],
    
    // === COUPLING & COMPLEXITY ANALYSIS (Design) ===
    ['too-many-imports', { name: 'too-many-imports', weight: 7, category: 'design' }],
    ['shotgun-surgery', { name: 'shotgun-surgery', weight: 7, category: 'design' }],
    ['data-clumps', { name: 'data-clumps', weight: 6, category: 'design' }],
    ['long-parameter-list', { name: 'long-parameter-list', weight: 5, category: 'design' }],
    
    // === COMPLEXITY (Cognitive Load) ===
    ['cyclomatic-complexity', { name: 'cyclomatic-complexity', weight: 5, category: 'complexity' }],
    ['deep-nesting', { name: 'deep-nesting', weight: 4, category: 'complexity' }],
    ['large-function', { name: 'large-function', weight: 4, category: 'complexity' }],
    ['max-file-lines', { name: 'max-file-lines', weight: 3, category: 'complexity' }],
    
    // === CODE HEALTH (Hygiene) ===
    ['duplicate-code', { name: 'duplicate-code', weight: 6, category: 'hygiene' }],
    ['unused-exports', { name: 'unused-exports', weight: 2, category: 'hygiene' }],
  ]);

  /**
   * Calculate total penalty with category-specific weights and normalization
   * @param violations Array of architectural violations
   * @param totalLOC Total lines of code (must be positive)
   * @throws {Error} If totalLOC is invalid
   */
  calculatePenalty(violations: Violation[], totalLOC: number): ScoreBreakdown {
    if (totalLOC < PenaltyCalculator.MIN_LOC_FOR_NORMALIZATION) {
      throw new Error(`Invalid totalLOC: ${totalLOC}. Must be at least ${PenaltyCalculator.MIN_LOC_FOR_NORMALIZATION}`);
    }

    const categorized = this.categorizeViolations(violations);
    
    const structural = this.calculateCategoryPenalty(categorized.structural, 'structural');
    const design = this.calculateCategoryPenalty(categorized.design, 'design');
    const complexity = this.calculateCategoryPenalty(categorized.complexity, 'complexity');
    const hygiene = this.calculateCategoryPenalty(categorized.hygiene, 'hygiene');

    // Calculate Architecture Health Score (excluding Hygiene)
    // Apply category weights: Structural 40%, Design 30%, Complexity 20%
    const architecturePenalty = 
      (structural.penalty * this.categoryWeights.structural) +
      (design.penalty * this.categoryWeights.design) +
      (complexity.penalty * this.categoryWeights.complexity);

    // Hygiene is calculated separately (10% weight if included in total)
    const totalPenalty = architecturePenalty + (hygiene.penalty * this.categoryWeights.hygiene);

    // Apply project size normalization only to architecture penalty
    const normalizedArchitecturePenalty = this.normalizePenalty(architecturePenalty, totalLOC);
    const normalizedHygienePenalty = this.normalizePenalty(hygiene.penalty * this.categoryWeights.hygiene, totalLOC);
    const normalizedPenalty = normalizedArchitecturePenalty + normalizedHygienePenalty;

    return {
      structural,
      design,
      complexity,
      hygiene,
      totalPenalty,
      normalizedPenalty,
      architecturePenalty: normalizedArchitecturePenalty, // Separate architecture score
      hygienePenalty: normalizedHygienePenalty, // Separate hygiene score
    };
  }

  /**
   * Categorize violations by rule category
   */
  private categorizeViolations(violations: Violation[]): Record<RuleCategory, Violation[]> {
    const result: Record<RuleCategory, Violation[]> = {
      structural: [],
      design: [],
      complexity: [],
      hygiene: [],
    };

    for (const violation of violations) {
      const metadata = this.getRuleMetadata(violation.rule);
      const category = metadata?.category || 'hygiene';
      result[category].push(violation);
    }

    return result;
  }

  /**
   * Calculate penalty for a specific category
   */
  private calculateCategoryPenalty(
    violations: Violation[], 
    category: RuleCategory
  ): CategoryScore {
    let penalty = 0;

    for (const violation of violations) {
      const metadata = this.getRuleMetadata(violation.rule);
      const weight = metadata?.weight || 1;
      const severityMultiplier = this.severityMultipliers[violation.severity];
      const categoryMultiplier = this.categoryMultipliers[category];

      // Formula: weight × severity × category multiplier
      penalty += weight * severityMultiplier * categoryMultiplier;
    }

    // Get top issues for this category
    const topIssues = violations
      .sort((a, b) => {
        const weightA = this.getRuleMetadata(a.rule)?.weight || 1;
        const weightB = this.getRuleMetadata(b.rule)?.weight || 1;
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

  /**
   * Normalize penalty based on project size using power-law scaling
   * Larger projects get increasingly favorable normalization to avoid unfair penalties
   */
  private normalizePenalty(penalty: number, totalLOC: number): number {
    if (totalLOC <= PenaltyCalculator.SMALL_PROJECT_THRESHOLD) {
      // Small projects - no normalization to maintain strict standards
      return penalty;
    }

    const baselineSize = PenaltyCalculator.BASELINE_PROJECT_SIZE;
    let powerFactor: number;

    if (totalLOC <= PenaltyCalculator.MEDIUM_PROJECT_THRESHOLD) {
      // Medium projects (5K-50K LOC)
      powerFactor = PenaltyCalculator.NORMALIZATION_POWER_SMALL;
    } else if (totalLOC <= PenaltyCalculator.LARGE_PROJECT_THRESHOLD) {
      // Large projects (50K-200K LOC)
      powerFactor = PenaltyCalculator.NORMALIZATION_POWER_MEDIUM;
    } else {
      // Enterprise projects (>200K LOC)
      powerFactor = PenaltyCalculator.NORMALIZATION_POWER_LARGE;
    }

    const normalizationFactor = Math.pow(baselineSize / totalLOC, powerFactor);
    return penalty * normalizationFactor;
  }

  /**
   * Get rule metadata
   */
  private getRuleMetadata(ruleName: string): RuleMetadata | undefined {
    // Normalize rule name (remove spaces, convert to lowercase)
    const normalized = ruleName.toLowerCase().replace(/\s+/g, '-');
    return this.ruleMetadata.get(normalized);
  }

  /**
   * Determine impact level based on penalty threshold
   */
  private getImpactLevel(penalty: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (penalty >= PenaltyCalculator.HIGH_IMPACT_THRESHOLD) return 'HIGH';
    if (penalty >= PenaltyCalculator.MEDIUM_IMPACT_THRESHOLD) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Get all rule metadata
   */
  getRuleMetadataMap(): Map<string, RuleMetadata> {
    return new Map(this.ruleMetadata);
  }

  /**
   * Get category multiplier
   */
  getCategoryMultiplier(category: RuleCategory): number {
    return this.categoryMultipliers[category];
  }
}
