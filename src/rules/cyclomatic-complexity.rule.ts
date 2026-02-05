import { SyntaxKind, Node } from 'ts-morph';
import { FunctionAnalysisRule, FunctionCheckContext, ArrowFunctionCheckContext } from './base/function-analysis.rule.js';
import { calculateSeverity, calculatePenalty, SeverityThresholds } from './utils/severity-calculator.js';
import { STANDARD_PENALTY_CONFIG, COMPLEXITY_IMPACT, createSeverityThresholds } from './utils/function-analysis-config.js';
import { Severity } from '../core/types.js';

/**
 * High Cyclomatic Complexity Rule
 * 
 * Calculates cyclomatic complexity by counting decision points
 * 
 * Why it matters:
 * - High complexity makes code harder to understand and test
 * - Increases bug probability exponentially
 * - Makes code difficult to maintain and modify
 * - Indicates need for refactoring
 * 
 * Formula: Count decision points (if, for, while, case, &&, ||, ?, catch)
 * 
 * Thresholds:
 * - >20: HIGH (critical refactor needed)
 * - 15-19: MEDIUM (should refactor)
 * - 10-14: LOW (consider refactoring)
 */

const SEVERITY_THRESHOLDS: SeverityThresholds = createSeverityThresholds(20, 15);

const PENALTY_CONFIG = {
  ...STANDARD_PENALTY_CONFIG,
  criticalBase: 20  // Higher penalty for cyclomatic complexity
};

export class CyclomaticComplexityRule extends FunctionAnalysisRule {
  name = 'cyclomatic-complexity';
  severity: Severity = 'info';
  penalty = 10;

  protected getConfigKey(): string {
    return 'maxComplexity';
  }

  protected getDefaultThreshold(): number {
    return 10;
  }

  protected checkFunction(
    func: import('ts-morph').FunctionDeclaration,
    context: FunctionCheckContext
  ): void {
    this.checkFunctionGeneric({
      body: func.getBody(),
      getName: () => func.getName() || 'anonymous',
      getLine: () => func.getStartLineNumber(),
      context,
      rule: 'High Cyclomatic Complexity',
      metric: 'cyclomatic complexity',
      impact: COMPLEXITY_IMPACT,
      suggestedFix: 'Break down into smaller functions with single responsibilities. Extract complex conditionals into helper methods. Simplify logic by using early returns, strategy pattern, or lookup tables. Target complexity <10 for easier testing.',
      calculateMetric: (body) => this.calculateComplexity(body),
      calculateSeverity: (value) => calculateSeverity(value, SEVERITY_THRESHOLDS),
      calculatePenalty: (value) => calculatePenalty(value, context.threshold, SEVERITY_THRESHOLDS, PENALTY_CONFIG)
    });
  }

  protected checkMethod(
    method: import('ts-morph').MethodDeclaration,
    context: FunctionCheckContext
  ): void {
    this.checkMethodGeneric({
      method,
      body: method.getBody(),
      context,
      rule: 'High Cyclomatic Complexity',
      metric: 'cyclomatic complexity',
      impact: COMPLEXITY_IMPACT,
      suggestedFix: 'Extract complex logic into helper methods. Use polymorphism instead of conditionals. Simplify nested conditions with guard clauses. Consider state pattern for complex state management.',
      calculateMetric: (body) => this.calculateComplexity(body),
      calculateSeverity: (value) => calculateSeverity(value, SEVERITY_THRESHOLDS),
      calculatePenalty: (value) => calculatePenalty(value, context.threshold, SEVERITY_THRESHOLDS, PENALTY_CONFIG)
    });
  }

  protected checkArrowFunction(context: ArrowFunctionCheckContext): void {
    this.checkArrowFunctionGeneric({
      context,
      body: context.arrowFunc.getBody(),
      rule: 'High Cyclomatic Complexity',
      metric: 'cyclomatic complexity',
      impact: COMPLEXITY_IMPACT,
      suggestedFix: 'Convert to named function and break down logic. Extract decision points into separate functions. Use array methods (map, filter, reduce) to simplify iterations.',
      calculateMetric: (body) => this.calculateComplexity(body),
      calculateSeverity: (value) => calculateSeverity(value, SEVERITY_THRESHOLDS),
      calculatePenalty: (value) => calculatePenalty(value, context.threshold, SEVERITY_THRESHOLDS, PENALTY_CONFIG)
    });
  }

  /**
   * Calculate cyclomatic complexity by counting decision points
   * Complexity = 1 + number of decision points
   */
  private calculateComplexity(node: Node): number {
    let complexity = 1; // Base complexity

    const DECISION_POINT_KINDS = new Set([
      SyntaxKind.IfStatement,
      SyntaxKind.ConditionalExpression,
      SyntaxKind.ForStatement,
      SyntaxKind.ForInStatement,
      SyntaxKind.ForOfStatement,
      SyntaxKind.WhileStatement,
      SyntaxKind.DoStatement,
      SyntaxKind.CaseClause,
      SyntaxKind.CatchClause
    ]);

    const LOGICAL_OPERATORS = new Set([
      SyntaxKind.AmpersandAmpersandToken, // &&
      SyntaxKind.BarBarToken, // ||
      SyntaxKind.QuestionQuestionToken // ??
    ]);

    const isLogicalBinaryExpression = (n: Node): boolean => {
      const binaryExpr = n as any;
      const operator = binaryExpr.getOperatorToken().getKind();
      return LOGICAL_OPERATORS.has(operator);
    };

    const countDecisionPoints = (n: Node): void => {
      const kind = n.getKind();

      if (DECISION_POINT_KINDS.has(kind)) {
        complexity++;
      } else if (kind === SyntaxKind.BinaryExpression && isLogicalBinaryExpression(n)) {
        complexity++;
      }

      n.getChildren().forEach(countDecisionPoints);
    };

    countDecisionPoints(node);
    return complexity;
  }
}
