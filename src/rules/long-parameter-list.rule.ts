import { FunctionDeclaration, MethodDeclaration, ConstructorDeclaration, ArrowFunction, VariableDeclaration } from 'ts-morph';
import { Violation, Severity } from '@core/types.js';
import { RuleContext } from '@core/rule-context.js';
import { getThresholdFromConfig } from './utils/rule-helpers.js';
import { shouldSkipNodeModules } from './utils/violation-utils.js';
import { ViolationData } from './utils/shared-types.js';
import { ParameterAnalysisRule } from './base/parameter-analysis.rule.js';
import { createViolation } from './utils/violation-utils.js';

/**
 * Long Parameter List Rule
 * 
 * Detects functions with too many parameters (>4 parameters)
 * 
 * Why it matters:
 * - Makes function calls harder to understand
 * - Increases cognitive load when reading code
 * - Makes testing more complex (many combinations)
 * - Often indicates missing abstraction
 * - Harder to maintain and refactor
 * 
 * Thresholds:
 * - >6 parameters: HIGH priority (critical refactor)
 * - 5-6 parameters: MEDIUM priority (should refactor)
 * - 4 parameters: LOW priority (consider refactoring)
 */

// Parameter count thresholds
const CRITICAL_PARAMETER_THRESHOLD = 6;

export class LongParameterListRule extends ParameterAnalysisRule {
  name = 'long-parameter-list';
  severity: Severity = 'warning';
  penalty = CRITICAL_PARAMETER_THRESHOLD;

  private readonly defaultThreshold = 4;
  private threshold = this.defaultThreshold;
  private violations: Violation[] = [];

  /**
   * Override check to set threshold from config before processing
   */
  check(context: RuleContext): Violation[] {
    this.violations = [];
    const ruleConfig = context.config.rules?.[this.name as keyof typeof context.config.rules];
    this.threshold = getThresholdFromConfig(ruleConfig, 'maxParameters') ?? this.defaultThreshold;
    
    return super.check(context);
  }

  protected shouldSkipFile(filePath: string): boolean {
    return shouldSkipNodeModules(filePath);
  }

  protected processFunction(func: FunctionDeclaration, relativePath: string): void {
    const params = func.getParameters();
    if (params.length > this.threshold) {
      const functionName = func.getName() || '<anonymous>';
      
      this.violations.push(this.createViolation({
        name: functionName,
        count: params.length,
        threshold: this.threshold,
        file: relativePath,
        line: func.getStartLineNumber(),
        type: 'function'
      }));
    }
  }

  protected processMethod(method: MethodDeclaration, className: string, relativePath: string): void {
    const params = method.getParameters();
    
    if (params.length > this.threshold) {
      const methodName = method.getName();
      
      this.violations.push(this.createViolation({
        name: `${className}.${methodName}`,
        count: params.length,
        threshold: this.threshold,
        file: relativePath,
        line: method.getStartLineNumber(),
        type: 'method'
      }));
    }
  }

  protected processConstructor(constructor: ConstructorDeclaration, className: string, relativePath: string): void {
    const params = constructor.getParameters();
    
    // Constructors often have dependency injection, so we use a higher threshold
    if (params.length <= 6) return;
    
    if (params.length > this.threshold) {
      this.violations.push(this.createViolation({
        name: `${className}.constructor`,
        count: params.length,
        threshold: this.threshold,
        file: relativePath,
        line: constructor.getStartLineNumber(),
        type: 'constructor'
      }));
    }
  }

  protected processArrowFunction(
    arrowFunc: ArrowFunction,
    varName: string,
    relativePath: string,
    declaration: VariableDeclaration
  ): void {
    const params = arrowFunc.getParameters();
    
    if (params.length > this.threshold) {
      this.violations.push(this.createViolation({
        name: varName,
        count: params.length,
        threshold: this.threshold,
        file: relativePath,
        line: declaration.getStartLineNumber(),
        type: 'arrow function'
      }));
    }
  }

  protected getViolations(): Violation[] {
    return this.violations;
  }

  private createViolation(data: ViolationData): Violation {
      const fixMessage = data.type === 'constructor' 
        ? 'Use dependency injection container or grouping configuration objects.'
        : `Reduce parameters using:\n  1. Parameter object pattern (group related params)\n  2. Builder pattern for complex construction\n  3. Extract to multiple focused functions\n  4. Store configuration in class properties`;

      return createViolation({
            rule: 'Long Parameter List',
            severity: this.getSeverityByCount(data.count),
            message: `${data.type === 'method' ? 'Method' : data.type === 'constructor' ? 'Constructor' : 'Function'} '${data.name}' has ${data.count} parameters (max: ${data.threshold})`,
            file: data.file,
            line: data.line,
            impact: 'Reduces code readability, increases testing complexity, and makes refactoring harder',
            suggestedFix: fixMessage,
            penalty: this.calculatePenalty(data.count, data.threshold),
      });
  }

  private getSeverityByCount(count: number): 'info' | 'warning' | 'critical' {
    if (count > CRITICAL_PARAMETER_THRESHOLD) return 'critical'; // HIGH priority
    if (count >= 5) return 'warning';  // MEDIUM priority
    return 'info'; // LOW priority
  }

  private calculatePenalty(count: number, threshold: number): number {
    return Math.min(30, (count - threshold) * 5);
  }
}
