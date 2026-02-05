import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { ParameterAnalysisRule } from '../../../src/rules/base/parameter-analysis.rule.js';
import { RuleContext } from '../../../src/core/rule-context.js';
import { Violation, Severity } from '../../../src/core/types.js';
import { FunctionDeclaration, MethodDeclaration, ConstructorDeclaration, ArrowFunction, VariableDeclaration } from 'ts-morph';

/**
 * Concrete implementation of ParameterAnalysisRule for testing
 */
class TestParameterAnalysisRule extends ParameterAnalysisRule {
  name = 'test-parameter-analysis';
  severity: Severity = 'info';
  penalty = 5;

  private violations: Violation[] = [];

  protected processFunction(func: FunctionDeclaration, relativePath: string): void {
    const params = func.getParameters();
    if (params.length > 2) {
      this.violations.push({
        rule: 'Test Rule',
        severity: 'info',
        message: `Function has ${params.length} parameters`,
        file: relativePath,
        line: func.getStartLineNumber(),
        impact: 'Test impact',
        suggestedFix: 'Test fix',
        penalty: 5
      });
    }
  }

  protected processMethod(method: MethodDeclaration, className: string, relativePath: string): void {
    const params = method.getParameters();
    if (params.length > 2) {
      this.violations.push({
        rule: 'Test Rule',
        severity: 'info',
        message: `Method ${className}.${method.getName()} has ${params.length} parameters`,
        file: relativePath,
        line: method.getStartLineNumber(),
        impact: 'Test impact',
        suggestedFix: 'Test fix',
        penalty: 5
      });
    }
  }

  protected processConstructor(constructor: ConstructorDeclaration, className: string, relativePath: string): void {
    const params = constructor.getParameters();
    if (params.length > 2) {
      this.violations.push({
        rule: 'Test Rule',
        severity: 'info',
        message: `Constructor ${className} has ${params.length} parameters`,
        file: relativePath,
        line: constructor.getStartLineNumber(),
        impact: 'Test impact',
        suggestedFix: 'Test fix',
        penalty: 5
      });
    }
  }

  protected processArrowFunction(
    arrowFunc: ArrowFunction,
    varName: string,
    relativePath: string,
    declaration: VariableDeclaration
  ): void {
    const params = arrowFunc.getParameters();
    if (params.length > 2) {
      this.violations.push({
        rule: 'Test Rule',
        severity: 'info',
        message: `Arrow function ${varName} has ${params.length} parameters`,
        file: relativePath,
        line: declaration.getStartLineNumber(),
        impact: 'Test impact',
        suggestedFix: 'Test fix',
        penalty: 5
      });
    }
  }

  protected getViolations(): Violation[] {
    return this.violations;
  }

  // Reset violations for each test
  reset(): void {
    this.violations = [];
  }
}

describe('ParameterAnalysisRule', () => {
  it('should process functions with many parameters', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'test.ts',
      `function testFunc(a: number, b: string, c: boolean) {
        return a + b + c;
      }`
    );

    const rule = new TestParameterAnalysisRule();
    const context: RuleContext = {
        project,
        config: { rules: { maxFileLines: 10 }, srcDirectory: '' },
        rootPath: '/test',
        graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('3 parameters');
  });

  it('should process methods in classes', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'test.ts',
      `class TestClass {
        myMethod(a: number, b: string, c: boolean) {
          return a + b + c;
        }
      }`
    );

    const rule = new TestParameterAnalysisRule();
    const context: RuleContext = {
        graph: { nodes: new Map(), cyclicGroups: [] },
        project,
        config: { rules: { maxFileLines: 10 }, srcDirectory: '' },
        rootPath: '/test'
    };

    const violations = rule.check(context);
    
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('TestClass.myMethod');
  });

  it('should process constructors', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'test.ts',
      `class TestClass {
        constructor(a: number, b: string, c: boolean) {
          this.a = a;
        }
      }`
    );

    const rule = new TestParameterAnalysisRule();
    const context: RuleContext = {
        graph: { nodes: new Map(), cyclicGroups: [] },
        project,
        config: { rules: { maxFileLines: 10 }, srcDirectory: '' },
        rootPath: '/test'
    };

    const violations = rule.check(context);
    
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('Constructor TestClass');
  });

  it('should process arrow functions', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'test.ts',
      `const myArrow = (a: number, b: string, c: boolean) => {
        return a + b + c;
      };`
    );

    const rule = new TestParameterAnalysisRule();
    const context: RuleContext = {
      project,
      config: { rules: { maxFileLines: 10 }, srcDirectory: '' },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('Arrow function myArrow');
  });

  it('should skip node_modules files by default', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'node_modules/test.ts',
      `function testFunc(a: number, b: string, c: boolean) {
        return a + b + c;
      }`
    );

    const rule = new TestParameterAnalysisRule();
    const context: RuleContext = {
      project,
      config: { rules: { maxFileLines: 10 }, srcDirectory: '' },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    
    expect(violations).toHaveLength(0);
  });

  it('should skip .d.ts files by default', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'test.d.ts',
      `function testFunc(a: number, b: string, c: boolean): void;`
    );

    const rule = new TestParameterAnalysisRule();
    const context: RuleContext = {
      project,
      config: { rules: { maxFileLines: 10 }, srcDirectory: '' },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    
    expect(violations).toHaveLength(0);
  });

  it('should process multiple types in same file', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'test.ts',
      `
      function standalone(a: number, b: string, c: boolean) {}
      
      class MyClass {
        constructor(a: number, b: string, c: boolean) {}
        method(a: number, b: string, c: boolean) {}
      }
      
      const arrow = (a: number, b: string, c: boolean) => {};
      `
    );

    const rule = new TestParameterAnalysisRule();
    const context: RuleContext = {
      project,
      config: { rules: { maxFileLines: 10 }, srcDirectory: '' },
      rootPath: '/test',
        graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    
    // Should find: 1 function + 1 constructor + 1 method + 1 arrow = 4
    expect(violations).toHaveLength(4);
  });
});
