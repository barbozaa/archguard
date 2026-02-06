import { FunctionDeclaration, MethodDeclaration } from 'ts-morph';
import { FunctionAnalysisRule, FunctionCheckContext, ArrowFunctionCheckContext } from './base/function-analysis.rule.js';
import { calculateSeverity, calculatePenalty, PenaltyConfig } from './utils/severity-calculator.js';
import { createSeverityThresholds } from './utils/function-analysis-config.js';
import { Severity } from '@core/types.js';

/**
 * Large Function Rule
 * 
 * Detects functions or methods exceeding recommended line count (>50 lines)
 * 
 * Why it matters:
 * - Large functions violate Single Responsibility Principle
 * - Harder to test, understand, and maintain
 * - Difficult code reviews
 * - Often indicate missing abstractions
 * 
 * Thresholds:
 * - >100 lines: HIGH priority (severe maintainability issue)
 * - 75-99 lines: MEDIUM priority (needs refactoring)
 * - 50-74 lines: LOW priority (minor improvement)
 */

const SEVERITY_THRESHOLDS = createSeverityThresholds(100, 75);

// Custom penalty config for line-based metrics (smaller multipliers)
const PENALTY_CONFIG: PenaltyConfig = {
  criticalBase: 15,
  criticalMultiplier: 0.1,
  warningBase: 10,
  warningMultiplier: 0.1,
  infoBase: 5,
  infoMultiplier: 0.05
};

export class LargeFunctionRule extends FunctionAnalysisRule {
  name = 'large-function';
  severity: Severity = 'info';
  penalty = 5;

  protected getConfigKey(): string {
    return 'maxLines';
  }

  protected getDefaultThreshold(): number {
    return 50;
  }

  protected checkFunction(
    func: FunctionDeclaration,
    context: FunctionCheckContext
  ): void {
    this.checkFunctionGeneric({
      body: func.getBody(),
      getName: () => func.getName() ?? '<anonymous>',
      getLine: () => func.getStartLineNumber(),
      context,
      rule: 'Large Function',
      metric: 'lines',
      impact: 'Reduces testability, code comprehension, and maintainability',
      suggestedFix: 'Split large function into smaller helper functions. Extract complex logic into well-named private functions or utility modules.',
      calculateMetric: (body) => this.getBodyLineCount(body.getText()),
      calculateSeverity: (value) => calculateSeverity(value, SEVERITY_THRESHOLDS),
      calculatePenalty: (value) => calculatePenalty(value, context.threshold, SEVERITY_THRESHOLDS, PENALTY_CONFIG)
    });
  }

  protected checkMethod(
    method: MethodDeclaration,
    context: FunctionCheckContext
  ): void {
    this.checkMethodGeneric({
      method,
      body: method.getBody(),
      context,
      rule: 'Large Function',
      metric: 'lines',
      impact: 'Reduces testability, code comprehension, and maintainability',
      suggestedFix: 'Split method into smaller helper methods. Extract complex logic into separate private methods or utility functions.',
      calculateMetric: (body) => this.getBodyLineCount(body.getText()),
      calculateSeverity: (value) => calculateSeverity(value, SEVERITY_THRESHOLDS),
      calculatePenalty: (value) => calculatePenalty(value, context.threshold, SEVERITY_THRESHOLDS, PENALTY_CONFIG)
    });
  }

  protected checkArrowFunction(context: ArrowFunctionCheckContext): void {
    this.checkArrowFunctionGeneric({
      context,
      body: context.arrowFunc.getBody(),
      rule: 'Large Function',
      metric: 'lines',
      impact: 'Reduces testability, code comprehension, and maintainability',
      suggestedFix: 'Convert to named function and break down logic. Extract complex operations into separate functions.',
      calculateMetric: (body) => this.getBodyLineCount(body.getText()),
      calculateSeverity: (value) => calculateSeverity(value, SEVERITY_THRESHOLDS),
      calculatePenalty: (value) => calculatePenalty(value, context.threshold, SEVERITY_THRESHOLDS, PENALTY_CONFIG)
    });
  }

  private getBodyLineCount(bodyText: string): number {
    // Remove opening and closing braces, trim, and count non-empty lines
    const cleaned = bodyText.trim();
    const withoutBraces = cleaned.slice(1, -1).trim();
    const lines = withoutBraces.split('\n');
    
    // Count only non-empty, non-comment-only lines
    return lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && 
             !trimmed.startsWith('//') && 
             !trimmed.startsWith('/*') &&
             !trimmed.startsWith('*');
    }).length;
  }
}
