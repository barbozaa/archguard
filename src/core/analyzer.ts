import { ProjectLoader } from './project-loader.js';
import { GraphBuilder } from './graph-builder.js';
import { Rule } from '../rules/rule-interface.js';
import { AnalysisResult, DependencyGraph, RuleError } from './types.js';
import { Config } from '../config/config-schema.js';
import { ScoreCalculator } from '../output/score-calculator.js';
import { RiskRanker } from '../output/risk-ranker.js';
import { createRuleContext } from './rule-context.js';
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
  DeadCodeRule,
  LongParameterListRule,
  DataClumpsRule,
  ShotgunSurgeryRule,
  MaxFileLinesRule,
} from '../rules/index.js';

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
    new DeadCodeRule(),
  ];

  private projectLoader = new ProjectLoader();
  private graphBuilder = new GraphBuilder();
  private scoreCalculator = new ScoreCalculator();
  private riskRanker = new RiskRanker();

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
    const { score, status, breakdown } = this.scoreCalculator.calculate(
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

    const result: AnalysisResult = {
      violations,
      score,
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
}
