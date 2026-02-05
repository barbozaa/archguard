import { SyntaxKind, ArrowFunction } from 'ts-morph';
import type { Rule } from '../rule-interface.js';
import type { RuleContext } from '../../core/rule-context.js';
import type { Violation, Severity } from '../../core/types.js';
import { shouldSkipNodeModules, getRelativePath } from '../utils/violation-utils.js';

/**
 * Context object for function checking operations
 * Consolidates common parameters into a single object
 */
export interface FunctionCheckContext {
  readonly filePath: string;
  readonly rootPath: string;
  readonly threshold: number;
  readonly violations: Violation[];
}

/**
 * Context object for arrow function checking operations
 * Extends FunctionCheckContext with arrow function specific data
 */
export interface ArrowFunctionCheckContext extends FunctionCheckContext {
  readonly arrowFunc: ArrowFunction;
  readonly name: string;
}

/**
 * Abstract base class for rules that analyze functions, methods, and arrow functions
 * Implements the template method pattern to eliminate duplicate code across similar rules
 * 
 * Subclasses must implement:
 * - getConfigKey(): Returns the config key for threshold lookup
 * - getDefaultThreshold(): Returns the default threshold value
 * - checkFunction(): Analyzes a function declaration
 * - checkMethod(): Analyzes a class method
 * - checkArrowFunction(): Analyzes an arrow function
 */
export abstract class FunctionAnalysisRule implements Rule {
  abstract name: string;
  abstract severity: Severity;
  abstract penalty: number;

  /**
   * Main check method that orchestrates the analysis
   * This implements the template method pattern
   */
  check(context: RuleContext): Violation[] {
    const { project, config, rootPath } = context;
    const violations: Violation[] = [];
    const sourceFiles = project.getSourceFiles();

    // Get threshold from config or use default
    const configValue = (config.rules as any)?.[this.name];
    const threshold = configValue?.[this.getConfigKey()] || this.getDefaultThreshold();

    for (const sourceFile of sourceFiles) {
      const filePath = sourceFile.getFilePath();
      
      // Skip if in node_modules
      if (shouldSkipNodeModules(filePath)) {
        continue;
      }

      const checkContext: FunctionCheckContext = { filePath, rootPath, threshold, violations };

      this.analyzeFunctions(sourceFile, checkContext);
      this.analyzeMethods(sourceFile, checkContext);
      this.analyzeArrowFunctions(sourceFile, checkContext);
    }

    return violations;
  }

  /**
   * Analyze all function declarations in a source file
   */
  private analyzeFunctions(sourceFile: any, context: FunctionCheckContext): void {
    const functions = sourceFile.getFunctions();
    for (const func of functions) {
      this.checkFunction(func, context);
    }
  }

  /**
   * Analyze all class methods in a source file
   */
  private analyzeMethods(sourceFile: any, context: FunctionCheckContext): void {
    const classes = sourceFile.getClasses();
    for (const cls of classes) {
      const methods = cls.getMethods();
      for (const method of methods) {
        this.checkMethod(method, context);
      }
    }
  }

  /**
   * Analyze all arrow functions in a source file
   */
  private analyzeArrowFunctions(sourceFile: any, context: FunctionCheckContext): void {
    const variableStatements = sourceFile.getVariableStatements();
    for (const stmt of variableStatements) {
      const declarations = stmt.getDeclarations();
      for (const decl of declarations) {
        const initializer = decl.getInitializer();
        if (initializer && initializer.getKind() === SyntaxKind.ArrowFunction) {
          const arrowContext: ArrowFunctionCheckContext = {
            ...context,
            arrowFunc: initializer as ArrowFunction,
            name: decl.getName()
          };
          this.checkArrowFunction(arrowContext);
        }
      }
    }
  }

  /**
   * Returns the config key for threshold lookup
   * e.g., 'maxComplexity', 'maxDepth', 'maxLines'
   */
  protected abstract getConfigKey(): string;

  /**
   * Returns the default threshold value
   */
  protected abstract getDefaultThreshold(): number;

  /**
   * Check a function declaration
   */
  protected abstract checkFunction(func: any, context: FunctionCheckContext): void;

  /**
   * Check a class method
   */
  protected abstract checkMethod(method: any, context: FunctionCheckContext): void;

  /**
   * Check an arrow function
   */
  protected abstract checkArrowFunction(context: ArrowFunctionCheckContext): void;

  /**
   * Helper method to create a function violation with standardized structure
   */
  protected createFunctionViolation(params: {
    rule: string;
    severity: 'info' | 'warning' | 'critical';
    functionName: string;
    metric: string;
    metricValue: number;
    threshold: number;
    line: number;
    filePath: string;
    rootPath: string;
    impact: string;
    suggestedFix: string;
    penalty: number;
  }): Violation {
    return {
      rule: params.rule,
      severity: params.severity,
      message: `Function '${params.functionName}' has ${params.metric} of ${params.metricValue} (max: ${params.threshold})`,
      file: getRelativePath(params.filePath, params.rootPath),
      line: params.line,
      impact: params.impact,
      suggestedFix: params.suggestedFix,
      penalty: params.penalty
    };
  }

  /**
   * Helper method to create a method violation with standardized structure
   */
  protected createMethodViolation(params: {
    rule: string;
    severity: 'info' | 'warning' | 'critical';
    className: string;
    methodName: string;
    metric: string;
    metricValue: number;
    threshold: number;
    line: number;
    filePath: string;
    rootPath: string;
    impact: string;
    suggestedFix: string;
    penalty: number;
  }): Violation {
    return {
      rule: params.rule,
      severity: params.severity,
      message: `Method '${params.className}.${params.methodName}' has ${params.metric} of ${params.metricValue} (max: ${params.threshold})`,
      file: getRelativePath(params.filePath, params.rootPath),
      line: params.line,
      impact: params.impact,
      suggestedFix: params.suggestedFix,
      penalty: params.penalty
    };
  }

  /**
   * Helper method to create an arrow function violation with standardized structure
   */
  protected createArrowFunctionViolation(params: {
    rule: string;
    severity: 'info' | 'warning' | 'critical';
    functionName: string;
    metric: string;
    metricValue: number;
    threshold: number;
    line: number;
    filePath: string;
    rootPath: string;
    impact: string;
    suggestedFix: string;
    penalty: number;
  }): Violation {
    return {
      rule: params.rule,
      severity: params.severity,
      message: `Arrow function '${params.functionName}' has ${params.metric} of ${params.metricValue} (max: ${params.threshold})`,
      file: getRelativePath(params.filePath, params.rootPath),
      line: params.line,
      impact: params.impact,
      suggestedFix: params.suggestedFix,
      penalty: params.penalty
    };
  }

  /**
   * Helper to get class name from a method's parent
   */
  protected getClassName(method: any): string {
    const parent = method.getParent();
    return parent && 'getName' in parent && typeof parent.getName === 'function' 
      ? (parent.getName() ?? '<unknown>') 
      : '<unknown>';
  }

  /**
   * Template method for generic function checking
   * Extracts common violation creation logic
   */
  protected checkFunctionGeneric(params: {
    body: any;
    getName: () => string;
    getLine: () => number;
    context: FunctionCheckContext;
    rule: string;
    metric: string;
    impact: string;
    suggestedFix: string;
    calculateMetric: (body: any) => number;
    calculateSeverity: (value: number) => 'info' | 'warning' | 'critical';
    calculatePenalty: (value: number) => number;
  }): void {
    const { body, getName, getLine, context, rule, metric, impact, suggestedFix, calculateMetric, calculateSeverity: getSeverity, calculatePenalty: getPenalty } = params;
    if (!body) return;

    const metricValue = calculateMetric(body);
    
    if (metricValue > context.threshold) {
      context.violations.push(
        this.createFunctionViolation({
          rule,
          severity: getSeverity(metricValue),
          functionName: getName() || '<anonymous>',
          metric,
          metricValue,
          threshold: context.threshold,
          line: getLine(),
          filePath: context.filePath,
          rootPath: context.rootPath,
          impact,
          suggestedFix,
          penalty: getPenalty(metricValue)
        })
      );
    }
  }

  /**
   * Template method for generic method checking
   */
  protected checkMethodGeneric(params: {
    method: any;
    body: any;
    context: FunctionCheckContext;
    rule: string;
    metric: string;
    impact: string;
    suggestedFix: string;
    calculateMetric: (body: any) => number;
    calculateSeverity: (value: number) => 'info' | 'warning' | 'critical';
    calculatePenalty: (value: number) => number;
  }): void {
    const { method, body, context, rule, metric, impact, suggestedFix, calculateMetric, calculateSeverity: getSeverity, calculatePenalty: getPenalty } = params;
    if (!body) return;

    const metricValue = calculateMetric(body);
    
    if (metricValue > context.threshold) {
      context.violations.push(
        this.createMethodViolation({
          rule,
          severity: getSeverity(metricValue),
          className: this.getClassName(method),
          methodName: method.getName(),
          metric,
          metricValue,
          threshold: context.threshold,
          line: method.getStartLineNumber(),
          filePath: context.filePath,
          rootPath: context.rootPath,
          impact,
          suggestedFix,
          penalty: getPenalty(metricValue)
        })
      );
    }
  }

  /**
   * Template method for generic arrow function checking
   */
  protected checkArrowFunctionGeneric(params: {
    context: ArrowFunctionCheckContext;
    body: any;
    rule: string;
    metric: string;
    impact: string;
    suggestedFix: string;
    calculateMetric: (body: any) => number;
    calculateSeverity: (value: number) => 'info' | 'warning' | 'critical';
    calculatePenalty: (value: number) => number;
  }): void {
    const { context, body, rule, metric, impact, suggestedFix, calculateMetric, calculateSeverity: getSeverity, calculatePenalty: getPenalty } = params;
    if (!body) return;

    const metricValue = calculateMetric(body);
    
    if (metricValue > context.threshold) {
      context.violations.push(
        this.createArrowFunctionViolation({
          rule,
          severity: getSeverity(metricValue),
          functionName: context.name,
          metric,
          metricValue,
          threshold: context.threshold,
          line: context.arrowFunc.getStartLineNumber(),
          filePath: context.filePath,
          rootPath: context.rootPath,
          impact,
          suggestedFix,
          penalty: getPenalty(metricValue)
        })
      );
    }
  }
}
