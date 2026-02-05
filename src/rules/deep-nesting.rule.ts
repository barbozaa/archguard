import { SyntaxKind, Node, FunctionDeclaration, MethodDeclaration } from 'ts-morph';
import { FunctionAnalysisRule, FunctionCheckContext, ArrowFunctionCheckContext } from './base/function-analysis.rule.js';
import { calculateSeverity, calculatePenalty, SeverityThresholds } from './utils/severity-calculator.js';
import { STANDARD_PENALTY_CONFIG, NESTING_IMPACT, createSeverityThresholds } from './utils/function-analysis-config.js';
import { Severity } from '../core/types.js';

/**
 * Deep Nesting Rule
 * 
 * Detects functions with nesting depth >3 levels (if/for/while/try/switch)
 * 
 * Why it matters:
 * - Deeply nested code has high cyclomatic complexity
 * - Harder to read, understand, and maintain
 * - Increases cognitive load
 * - Makes testing edge cases difficult
 * - Often indicates missing abstractions
 * 
 * Thresholds:
 * - >5 levels: HIGH priority (3-5h effort)
 * - 4-5 levels: MEDIUM priority (2-3h effort)
 * - >3 levels: LOW priority (1-2h effort)
 */

const SEVERITY_THRESHOLDS: SeverityThresholds = createSeverityThresholds(5, 4);

export class DeepNestingRule extends FunctionAnalysisRule {
  name = 'deep-nesting';
  severity: Severity = 'info';
  penalty = 3;

  protected getConfigKey(): string {
    return 'maxDepth';
  }

  protected getDefaultThreshold(): number {
    return 3;
  }

  protected checkFunction(
    func: FunctionDeclaration,
    context: FunctionCheckContext
  ): void {
    this.checkFunctionGeneric({
      body: func.getBody(),
      getName: () => func.getName() ?? "<anonymous>",
      getLine: () => func.getStartLineNumber(),
      context,
      rule: 'Deep Nesting',
      metric: 'nesting depth',
      impact: NESTING_IMPACT,
      suggestedFix: 'Refactor nested blocks into smaller functions with descriptive names. Use early returns/guards to reduce nesting. Apply Extract Method pattern for complex conditional logic.',
      calculateMetric: (body) => this.calculateNestingDepth(body, 0),
      calculateSeverity: (value) => calculateSeverity(value, SEVERITY_THRESHOLDS),
      calculatePenalty: (value) => calculatePenalty(value, context.threshold, SEVERITY_THRESHOLDS, STANDARD_PENALTY_CONFIG)
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
      rule: 'Deep Nesting',
      metric: 'nesting depth',
      impact: NESTING_IMPACT,
      suggestedFix: 'Break method into smaller helper methods. Use early returns to flatten conditional logic. Extract nested blocks into separate private methods.',
      calculateMetric: (body) => this.calculateNestingDepth(body, 0),
      calculateSeverity: (value) => calculateSeverity(value, SEVERITY_THRESHOLDS),
      calculatePenalty: (value) => calculatePenalty(value, context.threshold, SEVERITY_THRESHOLDS, STANDARD_PENALTY_CONFIG)
    });
  }

  protected checkArrowFunction(context: ArrowFunctionCheckContext): void {
    this.checkArrowFunctionGeneric({
      context,
      body: context.arrowFunc.getBody(),
      rule: 'Deep Nesting',
      metric: 'nesting depth',
      impact: NESTING_IMPACT,
      suggestedFix: 'Break method into smaller helper methods. Use early returns and guard clauses to reduce nesting depth.',
      calculateMetric: (body) => this.calculateNestingDepth(body, 0),
      calculateSeverity: (value) => calculateSeverity(value, SEVERITY_THRESHOLDS),
      calculatePenalty: (value) => calculatePenalty(value, context.threshold, SEVERITY_THRESHOLDS, STANDARD_PENALTY_CONFIG)
    });
  }

  /**
   * Recursively calculate maximum nesting depth
   * Counts if/for/while/try/switch/case statements
   */
  private calculateNestingDepth(node: Node, currentDepth: number): number {
    let maxDepth = currentDepth;

    const children = node.getChildren();
    
    for (const child of children) {
      const childDepth = this.getChildDepth(child, currentDepth);
      const depth = this.calculateNestingDepth(child, childDepth);
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }

  private getChildDepth(child: Node, currentDepth: number): number {
    const kind = child.getKind();
    
    if (this.isNestingStatement(kind)) {
      return currentDepth + 1;
    }
    
    return currentDepth;
  }

  private isNestingStatement(kind: SyntaxKind): boolean {
    const nestingKinds = [
      SyntaxKind.IfStatement,
      SyntaxKind.ForStatement,
      SyntaxKind.ForInStatement,
      SyntaxKind.ForOfStatement,
      SyntaxKind.WhileStatement,
      SyntaxKind.DoStatement,
      SyntaxKind.SwitchStatement,
      SyntaxKind.TryStatement,
      SyntaxKind.CatchClause
    ];
    
    return nestingKinds.includes(kind);
  }
}
