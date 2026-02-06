import { FunctionDeclaration, MethodDeclaration, ConstructorDeclaration, ArrowFunction, VariableDeclaration } from 'ts-morph';
import { Violation, Severity } from '@core/types.js';
import { RuleContext } from '@core/rule-context.js';
import { getThresholdFromConfig } from './utils/rule-helpers.js';
import { ParameterAnalysisRule } from './base/parameter-analysis.rule.js';
import { createViolation } from './utils/violation-utils.js';

interface ParameterGroup {
  parameters: string[];
  types: string[];
  occurrences: {
    file: string;
    method: string;
    line: number;
  }[];
}

interface FunctionContext {
  filePath: string;
  functionName: string;
  className?: string;
}

export class DataClumpsRule extends ParameterAnalysisRule {
  name = 'data-clumps';
  severity: Severity = 'warning';
  penalty = 10;

  private readonly defaultMinOccurrences = 3;
  private minOccurrences = this.defaultMinOccurrences;
  private parameterGroups = new Map<string, ParameterGroup>();

  /**
   * Override check to set config and reset state before processing
   */
  check(context: RuleContext): Violation[] {
    this.parameterGroups = new Map();
    const ruleConfig = context.config.rules?.[this.name as keyof typeof context.config.rules];
    this.minOccurrences = getThresholdFromConfig(ruleConfig, 'minOccurrences') ?? this.defaultMinOccurrences;
    
    return super.check(context);
  }

  protected processFunction(func: FunctionDeclaration, relativePath: string): void {
    const funcName = func.getName() || 'anonymous';
    const context: FunctionContext = {
      filePath: relativePath,
      functionName: funcName
    };
    this.processParameters(func, context);
  }

  protected processMethod(method: MethodDeclaration, className: string, relativePath: string): void {
    const methodName = method.getName();
    const context: FunctionContext = {
      filePath: relativePath,
      functionName: methodName,
      className
    };
    this.processParameters(method, context);
  }

  protected processConstructor(constructor: ConstructorDeclaration, className: string, relativePath: string): void {
    const context: FunctionContext = {
      filePath: relativePath,
      functionName: 'constructor',
      className
    };
    this.processParameters(constructor, context);
  }

  protected processArrowFunction(
    arrowFunc: ArrowFunction,
    varName: string,
    relativePath: string,
    _: VariableDeclaration
  ): void {
    const context: FunctionContext = {
      filePath: relativePath,
      functionName: varName
    };
    this.processParameters(arrowFunc, context);
  }

  protected getViolations(): Violation[] {
    return this.generateViolations();
  }

  private processParameters(
    node: FunctionDeclaration | MethodDeclaration | ConstructorDeclaration | ArrowFunction,
    context: FunctionContext
  ): void {
    const parameters = node.getParameters();
    
    if (parameters.length < 3) return;

    const paramNames = parameters.map(p => p.getName());
    const paramTypes = parameters.map(p => p.getType().getText());
    
    // Create a signature to identify the group of parameters
    // We include types to be more specific, but names are also important for "Clumps" concept
    // often clumps have same names (e.g. start, end, context).
    const signature = paramNames.map((name, i) => `${name}:${paramTypes[i]}`).join(',');
    
    const methodName = context.className 
      ? `${context.className}.${context.functionName}`
      : context.functionName;
    
    if (this.parameterGroups.has(signature)) {
      this.parameterGroups.get(signature)?.occurrences.push({
        file: context.filePath,
        method: methodName,
        line: node.getStartLineNumber()
      });
    } else {
      this.parameterGroups.set(signature, {
        parameters: paramNames,
        types: paramTypes,
        occurrences: [{
          file: context.filePath,
          method: methodName,
          line: node.getStartLineNumber()
        }]
      });
    }
  }

  private generateViolations(): Violation[] {
    const violations: Violation[] = [];

    for (const group of this.parameterGroups.values()) {
      if (group.occurrences.length >= this.minOccurrences) {
        violations.push(createViolation({
          rule: 'Data Clumps',
          severity: this.severity,
          message: `Found data clump with ${group.parameters.length} parameters (${group.parameters.join(', ')}) appearing in ${group.occurrences.length} locations.`,
          file: group.occurrences[0].file,
          line: group.occurrences[0].line,
          impact: 'Repeating groups of parameters being passed around indicates missing abstraction.',
          suggestedFix: `Extract parameters (${group.parameters.join(', ')}) into a new class or interface.`,
          penalty: this.penalty
        }));
      }
    }
    
    return violations;
  }
}
