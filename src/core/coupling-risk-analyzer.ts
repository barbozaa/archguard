import { DependencyGraph, Violation, ModuleCouplingMetrics, CouplingRiskAnalysis } from '@core/types.js';

/**
 * Coupling Risk Analyzer
 * 
 * Architectural change risk analyzer based on dependency coupling metrics.
 * This is NOT a linter rule — it's a strategic metric for architecture governance.
 * 
 * Theory:
 * - High Ca (afferent coupling) = many modules depend on you = high blast radius
 * - High Ce (efferent coupling) = you depend on many = fragile to external changes
 * - Instability I = Ce/(Ca+Ce) measures resistance to change
 * - Cycles amplify risk non-linearly (cascading failures)
 * - Layer violations indicate architectural debt
 * 
 * Risk Model:
 * Risk = f(Ca, Ce, Instability, Cycles, LayerViolations)
 * - Primary driver: Ca (change amplification)
 * - Fragility penalty: High Ce = fragile to external changes
 * - Instability penalty: Only matters when Ca is high
 * - Cycle multiplier: Exponential penalty
 * - Hub detection: Top percentile Ca modules
 */
export class CouplingRiskAnalyzer {
  // === SEMANTIC CONSTANTS ===
  private static readonly HIGH_CA_THRESHOLD_PERCENTILE = 0.90; // Top 10% Ca modules
  private static readonly HIGH_CE_THRESHOLD_PERCENTILE = 0.90; // Top 10% Ce modules
  private static readonly INSTABILITY_HIGH_THRESHOLD = 0.75;    // I > 0.75 = unstable
  private static readonly CYCLE_RISK_MULTIPLIER = 2.5;          // Non-linear penalty
  private static readonly LAYER_VIOLATION_WEIGHT = 3.0;         // Architectural debt weight
  private static readonly HUB_AMPLIFICATION_FACTOR = 1.5;       // Hubs amplify risk
  private static readonly FRAGILITY_PENALTY_WEIGHT = 2.0;       // High Ce = fragile to changes
  private static readonly RISK_NORMALIZATION_FACTOR = 10;       // Scale to [0, 100]

  /**
   * Analyze coupling risk across the entire project
   * 
   * @param graph Dependency graph from GraphBuilder
   * @param violations Violations from rules (to extract cycles and layer violations)
   * @returns Complete coupling risk analysis
   */
  analyze(graph: DependencyGraph, violations: Violation[]): CouplingRiskAnalysis {
    const modules = Array.from(graph.nodes.keys());
    
    if (modules.length === 0) {
      return this.emptyAnalysis();
    }

    // Step 1: Calculate raw coupling metrics for each module
    const metricsMap = new Map<string, ModuleCouplingMetrics>();
    for (const modulePath of modules) {
      const ca = this.calculateAfferentCoupling(modulePath, graph);
      const ce = this.calculateEfferentCoupling(modulePath, graph);
      const instability = this.calculateInstability(ca, ce);
      const cycleCount = this.getCycleParticipation(modulePath, violations);
      const layerViolations = this.getLayerViolationCount(modulePath, violations);

      metricsMap.set(modulePath, {
        modulePath,
        ca,
        ce,
        instability,
        cycleCount,
        layerViolations,
        riskScore: 0, // Calculated in Step 3
      });
    }

    const allMetrics = Array.from(metricsMap.values());

    // Step 2: Calculate project-wide statistics
    const avgCa = this.average(allMetrics.map(m => m.ca));
    const avgCe = this.average(allMetrics.map(m => m.ce));
    const avgInstability = this.average(allMetrics.map(m => m.instability));

    // Step 3: Calculate risk scores with context-aware thresholds
    const caThreshold = this.percentile(allMetrics.map(m => m.ca), CouplingRiskAnalyzer.HIGH_CA_THRESHOLD_PERCENTILE);
    const ceThreshold = this.percentile(allMetrics.map(m => m.ce), CouplingRiskAnalyzer.HIGH_CE_THRESHOLD_PERCENTILE);

    const metricsWithRisk = allMetrics.map(m => ({
      ...m,
      riskScore: this.calculateRiskScore(m, caThreshold, ceThreshold),
    }));

    // Step 4: Identify problematic modules
    const highRiskModules = metricsWithRisk
      .filter(m => m.riskScore >= 50) // High risk threshold
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10); // Top 10

    const hubModules = metricsWithRisk
      .filter(m => m.ca >= caThreshold && m.ca > 0)
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 5); // Top 5 hubs

    const unstableModules = metricsWithRisk
      .filter(m => m.instability >= CouplingRiskAnalyzer.INSTABILITY_HIGH_THRESHOLD && m.ca > 0)
      .sort((a, b) => b.instability - a.instability)
      .slice(0, 5); // Top 5 unstable

    // Step 5: Calculate overall project risk
    const overallRisk = this.calculateOverallRisk(metricsWithRisk);

    return {
      projectAverageCa: avgCa,
      projectAverageCe: avgCe,
      projectAverageInstability: avgInstability,
      totalModules: modules.length,
      highRiskModules,
      hubModules,
      unstableModules,
      overallRisk,
    };
  }

  /**
   * Calculate afferent coupling (Ca) - number of modules depending on this module
   */
  private calculateAfferentCoupling(modulePath: string, graph: DependencyGraph): number {
    const node = graph.nodes.get(modulePath);
    return node?.dependents?.size ?? 0;
  }

  /**
   * Calculate efferent coupling (Ce) - number of modules this module depends on
   */
  private calculateEfferentCoupling(modulePath: string, graph: DependencyGraph): number {
    const node = graph.nodes.get(modulePath);
    return node?.dependencies?.size ?? 0;
  }

  /**
   * Calculate instability metric: I = Ce / (Ca + Ce)
   * I = 0: Maximally stable (only depended upon)
   * I = 1: Maximally unstable (only depends on others)
   */
  private calculateInstability(ca: number, ce: number): number {
    const total = ca + ce;
    if (total === 0) return 0; // Isolated module
    return ce / total;
  }

  /**
   * Count how many circular dependency violations involve this module
   */
  private getCycleParticipation(modulePath: string, violations: Violation[]): number {
    return violations.filter(v =>
      v.rule === 'circular-deps' &&
      (v.file === modulePath || v.message.includes(modulePath))
    ).length;
  }

  /**
   * Count how many layer violations involve this module
   */
  private getLayerViolationCount(modulePath: string, violations: Violation[]): number {
    return violations.filter(v =>
      v.rule === 'layer-violation' &&
      v.file === modulePath
    ).length;
  }

  /**
   * Calculate composite risk score for a module
   * 
   * Risk Model:
   * - Base risk from Ca (primary driver)
   * - Fragility penalty (high Ce)
   * - Instability penalty (only if Ca is high)
   * - Cycle multiplier (exponential)
   * - Layer violation weight
   * - Hub amplification
   */
  private calculateRiskScore(
    metrics: ModuleCouplingMetrics,
    caThreshold: number,
    ceThreshold: number
  ): number {
    // Base risk: Ca is primary driver (more dependents = higher blast radius)
    let risk = metrics.ca * 5;

    // Fragility penalty: high Ce = fragile to external changes
    if (metrics.ce >= ceThreshold) {
      risk += metrics.ce * CouplingRiskAnalyzer.FRAGILITY_PENALTY_WEIGHT;
    }

    // Instability penalty: only matters when you're a hub
    if (metrics.ca >= caThreshold) {
      risk += metrics.instability * 20; // High instability in a hub is dangerous
    }

    // Cycle multiplier: non-linear penalty
    if (metrics.cycleCount > 0) {
      risk *= (1 + metrics.cycleCount * CouplingRiskAnalyzer.CYCLE_RISK_MULTIPLIER);
    }

    // Layer violations: architectural debt
    risk += metrics.layerViolations * CouplingRiskAnalyzer.LAYER_VIOLATION_WEIGHT * 5;

    // Hub amplification: high Ca modules are critical
    if (metrics.ca >= caThreshold) {
      risk *= CouplingRiskAnalyzer.HUB_AMPLIFICATION_FACTOR;
    }

    // Normalize to [0, 100]
    return Math.min(100, risk / CouplingRiskAnalyzer.RISK_NORMALIZATION_FACTOR);
  }

  /**
   * Calculate overall project coupling risk
   * Weighted average with emphasis on high-risk modules
   */
  private calculateOverallRisk(metrics: ModuleCouplingMetrics[]): number {
    if (metrics.length === 0) return 0;

    // Weight by Ca: high-Ca modules contribute more to overall risk
    const weightedSum = metrics.reduce((sum, m) => {
      const weight = m.ca > 0 ? m.ca : 1;
      return sum + (m.riskScore * weight);
    }, 0);

    const totalWeight = metrics.reduce((sum, m) => sum + (m.ca > 0 ? m.ca : 1), 0);

    return Math.min(100, weightedSum / totalWeight);
  }

  /**
   * Calculate average of numbers
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Calculate percentile value from sorted values
   */
  private percentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Return empty analysis for edge cases
   */
  private emptyAnalysis(): CouplingRiskAnalysis {
    return {
      projectAverageCa: 0,
      projectAverageCe: 0,
      projectAverageInstability: 0,
      totalModules: 0,
      highRiskModules: [],
      hubModules: [],
      unstableModules: [],
      overallRisk: 0,
    };
  }
}
