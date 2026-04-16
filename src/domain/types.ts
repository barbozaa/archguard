export type { RuleContext } from '@application/rule-context.js';

export type Severity = 'info' | 'warning' | 'critical';

export type HealthStatus = 'Excellent' | 'Healthy' | 'Needs Attention' | 'Critical';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ModuleCouplingMetrics {
  readonly modulePath: string;
  readonly ca: number;
  readonly ce: number;
  readonly instability: number;
  readonly cycleCount: number;
  readonly layerViolations: number;
  readonly riskScore: number;
}

export interface CouplingRiskAnalysis {
  readonly projectAverageCa: number;
  readonly projectAverageCe: number;
  readonly projectAverageInstability: number;
  readonly totalModules: number;
  readonly highRiskModules: ReadonlyArray<ModuleCouplingMetrics>;
  readonly hubModules: ReadonlyArray<ModuleCouplingMetrics>;
  readonly unstableModules: ReadonlyArray<ModuleCouplingMetrics>;
  readonly overallRisk: number;
}

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
  architecturePenalty: number;
  hygienePenalty: number;
}

export interface BlastRadiusModule {
  modulePath: string;
  affectedModules: number;
}

export interface AnalysisResult {
  violations: Violation[];
  score: number;
  architectureScore: number;
  hygieneScore: number;
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
  blastRadius?: BlastRadiusModule[];
  confidenceLevel?: ConfidenceLevel;
  modulesAnalyzedPercent?: number;
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
