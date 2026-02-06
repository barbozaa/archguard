/**
 * Core type definitions for ArchGuard
 */

export type { RuleContext } from '@core/rule-context.js';

export type Severity = 'info' | 'warning' | 'critical';

export type HealthStatus = 'Excellent' | 'Healthy' | 'Needs Attention' | 'Critical';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Coupling metrics for a single module
 */
export interface ModuleCouplingMetrics {
  readonly modulePath: string;
  readonly ca: number;              // Afferent Coupling - modules depending on this
  readonly ce: number;              // Efferent Coupling - modules this depends on
  readonly instability: number;     // I = Ce / (Ca + Ce), range [0, 1]
  readonly cycleCount: number;      // Number of circular dependencies involving this module
  readonly layerViolations: number; // Number of layer violations involving this module
  readonly riskScore: number;       // Composite risk score [0, 100]
}

/**
 * Project-wide coupling risk analysis results
 */
export interface CouplingRiskAnalysis {
  readonly projectAverageCa: number;
  readonly projectAverageCe: number;
  readonly projectAverageInstability: number;
  readonly totalModules: number;
  readonly highRiskModules: ReadonlyArray<ModuleCouplingMetrics>;
  readonly hubModules: ReadonlyArray<ModuleCouplingMetrics>;
  readonly unstableModules: ReadonlyArray<ModuleCouplingMetrics>;
  readonly overallRisk: number; // Normalized [0, 100]
}

/**
 * Next action item for architecture improvements
 */
export interface NextAction {
  description: string;
  priority: string;
  effort: string;
  impact?: string;
  file?: string;
  line?: number;
}

export interface Violation {
  rule: string;
  severity: Severity;
  message: string;
  file: string;
  relatedFile?: string;
  line?: number;
  impact: string;
  suggestedFix: string;
  penalty: number;
}

export interface RuleError {
  ruleName: string;
  error: Error;
  stack?: string;
}

export interface CategoryScore {
  violations: number;
  penalty: number;
  weight: number;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  topIssues: Violation[];
}

export interface ScoreBreakdown {
  structural: CategoryScore;
  design: CategoryScore;
  complexity: CategoryScore;
  hygiene: CategoryScore;
  totalPenalty: number;
  normalizedPenalty: number;
  architecturePenalty: number;  // Architecture Health Score penalty (excludes hygiene)
  hygienePenalty: number;       // Separate Hygiene score penalty
}

export interface BlastRadiusModule {
  modulePath: string;
  affectedModules: number;  // Number of dependents (Ca)
}

export interface AnalysisResult {
  violations: Violation[];
  score: number;                    // Overall score (for backward compatibility)
  architectureScore: number;        // Architecture Health Score (excludes hygiene)
  hygieneScore: number;             // Separate Hygiene score
  status: HealthStatus;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  healthyModuleCount: number;
  totalModules: number;
  topRisks: Violation[];
  timestamp: string;
  projectName: string;
  ruleErrors?: RuleError[];
  scoreBreakdown?: ScoreBreakdown;
  totalLOC?: number;
  couplingRisk?: CouplingRiskAnalysis;
  blastRadius?: BlastRadiusModule[];  // Top 5 modules with highest impact
  confidenceLevel?: ConfidenceLevel;  // Analysis confidence based on coverage
  modulesAnalyzedPercent?: number;    // Percentage of modules successfully analyzed
}

export interface ProjectContext {
  rootPath: string;
  sourceFiles: string[];
  dependencies: Map<string, Set<string>>;
  moduleCount: number;
}

export interface DependencyNode {
  file: string;
  dependencies: Set<string>;
  dependents: Set<string>;
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  cyclicGroups: string[][];
}
