import { ProjectLoader } from '@core/project-loader.js';
import { GraphBuilder } from '@core/graph-builder.js';
import { CouplingRiskAnalyzer } from '@core/coupling-risk-analyzer.js';
import { Rule } from '@rules/rule-interface.js';
import { AnalysisResult, DependencyGraph, RuleError } from '@core/types.js';
import { Config } from '@config/config-schema.js';
import { ScoreCalculator } from '@output/score-calculator.js';
import { RiskRanker } from '@output/risk-ranker.js';
import { createRuleContext } from '@core/rule-context.js';
import { readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';

// Import all rules from barrel export
import {
  CircularDepsRule,
  LayerViolationRule,
  ForbiddenImportsRule,
  TooManyImportsRule,
  LargeFunctionRule,
  DeepNestingRule,
  UnusedExportsRule,
  CyclomaticComplexityRule,
  DuplicateCodeRule,
  LongParameterListRule,
  DataClumpsRule,
  ShotgunSurgeryRule,
  MaxFileLinesRule,
} from '@rules/index.js';

/**
 * Main analyzer that orchestrates the analysis process
 */
export class Analyzer {
  private rules: Rule[] = [
    // === CORE ARCHITECTURE RULES (Critical) ===
    new CircularDepsRule(),
    new LayerViolationRule(),
    new ForbiddenImportsRule(),
    
    // === COUPLING & COMPLEXITY ANALYSIS ===
    new TooManyImportsRule(),
    new CyclomaticComplexityRule(),
    new DeepNestingRule(),
    new LargeFunctionRule(),
    new MaxFileLinesRule(),
    
    // === DESIGN PATTERN & API QUALITY ===
    new LongParameterListRule(),
    new DataClumpsRule(),
    new ShotgunSurgeryRule(),
    
    // === CODE HEALTH ===
    new DuplicateCodeRule(),
    new UnusedExportsRule(),
  ];

  private projectLoader = new ProjectLoader();
  private graphBuilder = new GraphBuilder();
  private scoreCalculator = new ScoreCalculator();
  private riskRanker = new RiskRanker();
  private couplingRiskAnalyzer = new CouplingRiskAnalyzer();

  async analyze(config: Config): Promise<AnalysisResult> {
    // Load project
    const projectContext = await this.projectLoader.load(config);
    const project = this.projectLoader.getProject();

    // Build dependency graph
    const graph = this.graphBuilder.build(project, projectContext.rootPath);

    // Run all rules and capture errors
    const { violations, errors } = this.runRules(project, graph, config, projectContext.rootPath);

    // Count actual analyzed files (all source files in project, excluding node_modules)
    const sourceFiles = project.getSourceFiles()
      .filter(sf => !sf.getFilePath().includes('node_modules'));
    
    const actualModuleCount = sourceFiles.length;

    // Calculate total LOC
    const totalLOC = sourceFiles.reduce((sum, sf) => {
      return sum + sf.getEndLineNumber();
    }, 0);

    // Count violations by severity
    const counts = this.riskRanker.countBySeverity(violations);

    // Calculate score with weighted penalty system
    const { score, architectureScore, hygieneScore, status, breakdown } = this.scoreCalculator.calculate(
      violations,
      actualModuleCount,
      totalLOC
    );

    // Get top risks
    const topRisks = this.riskRanker.rank(violations, 5);

    // Calculate healthy modules
    const violatedFiles = new Set(violations.map(v => v.file));
    const healthyModuleCount = Math.max(0, actualModuleCount - violatedFiles.size);

    // Get project name from package.json or directory
    const projectName = this.getProjectName(projectContext.rootPath);

    // Analyze coupling risk (strategic architectural metric)
    const couplingRisk = this.couplingRiskAnalyzer.analyze(graph, violations);

    // Calculate Blast Radius: Top 5 modules with highest Ca (most dependents)
    const blastRadius = this.calculateBlastRadius(graph);

    // Calculate Confidence Score
    // High confidence = many modules analyzed, no errors
    const modulesAnalyzedPercent = 100; // All source files are analyzed
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
      modulesAnalyzedPercent,
    };

    // Add rule errors if any occurred
    if (errors.length > 0) {
      result.ruleErrors = errors;
    }

    return result;
  }

  private getProjectName(rootPath: string): string {
    try {
      // Try to read package.json
      const packageJsonPath = join(rootPath, 'package.json');
      
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.name) {
          return packageJson.name;
        }
      }
    } catch (error) {
      // Fallback to directory name
    }
    
    // Use directory name as fallback
    return basename(rootPath);
  }

  private runRules(
    project: any,
    graph: DependencyGraph,
    config: Config,
    rootPath: string
  ): { violations: any[]; errors: RuleError[] } {
    const allViolations = [];
    const ruleErrors: RuleError[] = [];
    const context = createRuleContext(project, graph, config, rootPath);

    for (const rule of this.rules) {
      try {
        const violations = rule.check(context);
        allViolations.push(...violations);
      } catch (error) {
        const ruleError = this.createRuleError(rule.name, error);
        ruleErrors.push(ruleError);
        this.logRuleError(rule.name, error);
      }
    }

    return { violations: allViolations, errors: ruleErrors };
  }

  private createRuleError(ruleName: string, error: unknown): RuleError {
    return {
      ruleName,
      error: error instanceof Error ? error : new Error(String(error)),
      stack: error instanceof Error ? error.stack : undefined,
    };
  }

  private logRuleError(ruleName: string, error: unknown): void {
    console.error(`\n⚠️  Error in rule "${ruleName}":`);
    console.error(error instanceof Error ? error.message : String(error));
    
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    console.error(''); // Empty line for readability
  }

  /**
   * Calculate Blast Radius: Top 5 modules with highest Ca (most dependents)
   * These modules have the highest change impact
   */
  private calculateBlastRadius(graph: DependencyGraph): import('./types.js').BlastRadiusModule[] {
    const modules = Array.from(graph.nodes.entries())
      .map(([path, node]) => ({
        modulePath: path,
        affectedModules: node.dependents.size,
      }))
      .filter(m => m.affectedModules > 0) // Only modules with dependents
      .sort((a, b) => b.affectedModules - a.affectedModules)
      .slice(0, 5);

    return modules;
  }

  /**
   * Calculate Confidence Level based on analysis coverage
   * HIGH: All modules analyzed successfully and no rule errors
   * MEDIUM: Some modules analyzed or minor rule errors
   * LOW: Rule errors occurred
   */
  private calculateConfidenceLevel(
    totalModules: number,
    hasRuleErrors: boolean
  ): import('./types.js').ConfidenceLevel {
    if (hasRuleErrors) {
      return 'LOW';
    }
    if (totalModules >= 10) {
      return 'HIGH'; // Sufficient modules for reliable analysis
    }
    return 'MEDIUM';
  }
}
