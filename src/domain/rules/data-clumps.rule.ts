import { FunctionDeclaration, MethodDeclaration, ConstructorDeclaration, ArrowFunction, VariableDeclaration } from 'ts-morph';
import { Violation, Severity } from '@domain/types.js';
import { RuleContext } from '@application/rule-context.js';
import { getThresholdFromConfig } from './utils/rule-helpers.js';
import { ParameterAnalysisRule, ClassMemberScope } from '@domain/rules/base/parameter-analysis.rule.js';
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

  check(context: RuleContext): Violation[] {
    this.parameterGroups = new Map();
    const ruleConfig = context.config.rules?.[this.name as keyof typeof context.config.rules];
    this.minOccurrences = getThresholdFromConfig(ruleConfig, 'minOccurrences') ?? this.defaultMinOccurrences;
    return super.check(context);
  }

  protected processFunction(func: FunctionDeclaration, relativePath: string): void {
    this.processParameters(func, {
      filePath: relativePath,
      functionName: func.getName() ?? 'anonymous',
    });
  }

  protected processMethod(method: MethodDeclaration, scope: ClassMemberScope): void {
    this.processParameters(method, {
      filePath: scope.relativePath,
      functionName: method.getName(),
      className: scope.className,
    });
  }

  protected processConstructor(constructor: ConstructorDeclaration, scope: ClassMemberScope): void {
    this.processParameters(constructor, {
      filePath: scope.relativePath,
      functionName: 'constructor',
      className: scope.className,
    });
  }

  protected processArrowFunction(
    arrowFunc: ArrowFunction,
    varName: string,
    relativePath: string,
    _: VariableDeclaration
  ): void {
    this.processParameters(arrowFunc, {
      filePath: relativePath,
      functionName: varName,
    });
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
    const signature = paramNames.map((name, i) => `${name}:${paramTypes[i]}`).join(',');

    const methodLabel = context.className
      ? `${context.className}.${context.functionName}`
      : context.functionName;

    const occurrence = { file: context.filePath, method: methodLabel, line: node.getStartLineNumber() };

    const existing = this.parameterGroups.get(signature);
    if (existing) {
      existing.occurrences.push(occurrence);
    } else {
      this.parameterGroups.set(signature, {
        parameters: paramNames,
        types: paramTypes,
        occurrences: [occurrence],
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
          penalty: this.penalty,
        }));
      }
    }

    return violations;
  }
}
