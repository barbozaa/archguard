/**
 * Core type definitions for ArchGuard
 */

export type { RuleContext } from './rule-context.js';

export type Severity = 'info' | 'warning' | 'critical';

export type HealthStatus = 'Excellent' | 'Healthy' | 'Needs Attention' | 'Critical';

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
}

export interface AnalysisResult {
  violations: Violation[];
  score: number;
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
