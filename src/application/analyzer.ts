import { ProjectLoader } from '@infrastructure/project-loader.js';
import { GraphBuilder } from '@infrastructure/graph-builder.js';
import { CouplingRiskAnalyzer } from '@application/coupling-risk-analyzer.js';
import { Project } from 'ts-morph';
import { Rule } from '@domain/rule.js';
import { AnalysisResult, Violation, DependencyGraph, RuleError, BlastRadiusModule, ConfidenceLevel } from '@domain/types.js';
import { Config } from '@infrastructure/config/config-schema.js';
import { ScoreCalculator } from '@domain/scoring/score-calculator.js';
import { RiskRanker } from '@domain/scoring/risk-ranker.js';
import { createRuleContext } from '@application/rule-context.js';
import { readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';

import {
  LayerViolationRule,
  FeatureBoundaryRule,
  TooManyImportsRule,
  ShotgunSurgeryRule,
  DataClumpsRule,
  DuplicateCodeRule,
} from '@domain/rules/index.js';

/**
 * Main analyzer that orchestrates the analysis process.
 *
 * Rules deliberately excluded (covered by ESLint):
 *   circular-deps        → import/no-cycle
 *   forbidden-imports    → no-restricted-imports
 *   cyclomatic-complexity → complexity
 *   deep-nesting         → max-depth
 *   large-function       → max-lines-per-function
 *   max-file-lines       → max-lines
 *   long-parameter-list  → max-params
 *   unused-exports       → knip / ts-prune
 */
export class Analyzer {
  private rules: Rule[] = [
    // Structural architecture
    new LayerViolationRule(),
    new FeatureBoundaryRule(),

    // Coupling analysis
    new TooManyImportsRule(),
    new ShotgunSurgeryRule(),

    // Design smells (cross-file analysis — impossible for linters)
    new DataClumpsRule(),

    // Code health
    new DuplicateCodeRule(),
  ];

  private projectLoader = new ProjectLoader();
  private graphBuilder = new GraphBuilder();
  private scoreCalculator = new ScoreCalculator();
  private riskRanker = new RiskRanker();
  private couplingRiskAnalyzer = new CouplingRiskAnalyzer();

  async analyze(config: Config): Promise<AnalysisResult> {
    const { result } = await this.analyzeWithGraph(config);
    return result;
  }

  /**
   * Full analysis plus dependency graph (for MCP / tooling: Mermaid, change-neighborhood, etc.).
   */
  async analyzeWithGraph(config: Config): Promise<{
    result: AnalysisResult;
    graph: DependencyGraph;
  }> {
    const projectContext = await this.projectLoader.load(config);
    const project = this.projectLoader.getProject();

    const graph = this.graphBuilder.build(project, projectContext.rootPath);
    const { violations, errors } = this.runRules(project, graph, config, projectContext.rootPath);

    const sourceFiles = project
      .getSourceFiles()
      .filter(sf => !sf.getFilePath().includes('node_modules'));

    const actualModuleCount = sourceFiles.length;
    const totalLOC = sourceFiles.reduce((sum, sf) => sum + sf.getEndLineNumber(), 0);

    const counts = this.riskRanker.countBySeverity(violations);
    const { score, architectureScore, hygieneScore, status, breakdown } =
      this.scoreCalculator.calculate(violations, actualModuleCount, totalLOC);

    const topRisks = this.riskRanker.rank(violations, 5);
    const violatedFiles = new Set(violations.map(v => v.file));
    const healthyModuleCount = Math.max(0, actualModuleCount - violatedFiles.size);
    const projectName = this.getProjectName(projectContext.rootPath);
    const couplingRisk = this.couplingRiskAnalyzer.analyze(graph, violations);
    const blastRadius = this.calculateBlastRadius(graph);
    const confidenceLevel = this.calculateConfidenceLevel(actualModuleCount, errors.length > 0);

    const result: AnalysisResult = {
      violations,
      score,
      architectureScore,
      hygieneScore,
      status,
      criticalCount: counts.critical,
      warningCount: counts.warning,
      infoCount: counts.info,
      healthyModuleCount,
      totalModules: actualModuleCount,
      topRisks,
      timestamp: new Date().toISOString(),
      projectName,
      scoreBreakdown: breakdown,
      totalLOC,
      couplingRisk,
      blastRadius,
      confidenceLevel,
      modulesAnalyzedPercent: 100,
    };

    if (errors.length > 0) {
      result.ruleErrors = errors;
    }

    return { result, graph };
  }

  private getProjectName(rootPath: string): string {
    try {
      const packageJsonPath = join(rootPath, 'package.json');
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.name) return packageJson.name;
      }
    } catch {
      // fall through
    }
    return basename(rootPath);
  }

  private runRules(
    project: Project,
    graph: DependencyGraph,
    config: Config,
    rootPath: string
  ): { violations: Violation[]; errors: RuleError[] } {
    const allViolations: Violation[] = [];
    const ruleErrors: RuleError[] = [];
    const context = createRuleContext(project, graph, config, rootPath);

    for (const rule of this.rules) {
      try {
        allViolations.push(...rule.check(context));
      } catch (error) {
        ruleErrors.push({
          ruleName: rule.name,
          error: error instanceof Error ? error : new Error(String(error)),
          stack: error instanceof Error ? error.stack : undefined,
        });
        console.error(`\n⚠️  Error in rule "${rule.name}":`, error instanceof Error ? error.message : error);
      }
    }

    return { violations: allViolations, errors: ruleErrors };
  }

  private calculateBlastRadius(graph: DependencyGraph): BlastRadiusModule[] {
    return Array.from(graph.nodes.entries())
      .map(([path, node]) => ({ modulePath: path, affectedModules: node.dependents.size }))
      .filter(m => m.affectedModules > 0)
      .sort((a, b) => b.affectedModules - a.affectedModules)
      .slice(0, 5);
  }

  private calculateConfidenceLevel(
    totalModules: number,
    hasRuleErrors: boolean
  ): ConfidenceLevel {
    if (hasRuleErrors) return 'LOW';
    if (totalModules >= 10) return 'HIGH';
    return 'MEDIUM';
  }
}
