import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { FunctionAnalysisRule } from '@rules/base/function-analysis.rule.js';
import type { RuleContext } from '@core/types.js';

class TestFunctionAnalysisRule extends FunctionAnalysisRule {
  name = 'test-rule';
  severity: 'info' | 'warning' | 'critical' = 'info';
  penalty = 5;

  protected getConfigKey(): string {
    return 'maxComplexity';
  }

  protected getDefaultThreshold(): number {
    return 10;
  }

  protected checkFunction(func: any, context: any): void {
    const functionName = func.getName() || '<anonymous>';
    if (functionName === 'badFunction') {
      context.violations.push({
        rule: this.name,
        severity: 'warning',
        message: `Function ${functionName} is bad`,
        file: 'test.ts',
        line: 1,
        impact: 'Test impact',
        suggestedFix: 'Fix it',
        penalty: 10
      });
    }
  }

  protected checkMethod(method: any, context: any): void {
    const methodName = method.getName();
    if (methodName === 'badMethod') {
      context.violations.push({
        rule: this.name,
        severity: 'warning',
        message: `Method ${methodName} is bad`,
        file: 'test.ts',
        line: 1,
        impact: 'Test impact',
        suggestedFix: 'Fix it',
        penalty: 10
      });
    }
  }

  protected checkArrowFunction(context: any): void {
    if (context.name === 'badArrow') {
      context.violations.push({
        rule: this.name,
        severity: 'warning',
        message: `Arrow function ${context.name} is bad`,
        file: 'test.ts',
        line: 1,
        impact: 'Test impact',
        suggestedFix: 'Fix it',
        penalty: 10
      });
    }
  }
}

describe('FunctionAnalysisRule', () => {
  let project: Project;
  let rule: TestFunctionAnalysisRule;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    rule = new TestFunctionAnalysisRule();
  });

  it('should analyze function declarations', () => {
    project.createSourceFile('test.ts', `
      function goodFunction() { return 1; }
      function badFunction() { return 2; }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500,  } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('badFunction');
  });

  it('should analyze class methods', () => {
    project.createSourceFile('test.ts', `
      class TestClass {
        goodMethod() { return 1; }
        badMethod() { return 2; }
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500,  } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('badMethod');
  });

  it('should analyze arrow functions', () => {
    project.createSourceFile('test.ts', `
      const goodArrow = () => 1;
      const badArrow = () => 2;
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500,  } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('badArrow');
  });

  it('should skip node_modules files', () => {
    project.createSourceFile('node_modules/test.ts', `
      function badFunction() { return 1; }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500,  } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(0);
  });

  it('should use threshold from config', () => {
    project.createSourceFile('test.ts', `
      function badFunction() { return 1; }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 
          'test-rule': { maxComplexity: 20 } } 
      },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(1);
  });

  it('should use default threshold when not in config', () => {
    project.createSourceFile('test.ts', `
      function badFunction() { return 1; }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500,  } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(1);
  });

  describe('violation helper methods', () => {
    it('should create function violation with correct format', () => {
      const violation = rule['createFunctionViolation']({
        rule: 'test',
        severity: 'warning',
        functionName: 'myFunc',
        metric: 'complexity',
        metricValue: 15,
        threshold: 10,
        line: 5,
        filePath: '/project/src/file.ts',
        rootPath: '/project',
        impact: 'High impact',
        suggestedFix: 'Fix this',
        penalty: 20
      });

      expect(violation.rule).toBe('test');
      expect(violation.severity).toBe('warning');
      expect(violation.message).toContain('myFunc');
      expect(violation.message).toContain('complexity of 15');
      expect(violation.file).toBe('src/file.ts');
      expect(violation.line).toBe(5);
      expect(violation.penalty).toBe(20);
    });

    it('should create method violation with correct format', () => {
      const violation = rule['createMethodViolation']({
        rule: 'test',
        severity: 'critical',
        className: 'MyClass',
        methodName: 'myMethod',
        metric: 'lines',
        metricValue: 100,
        threshold: 50,
        line: 10,
        filePath: '/project/src/file.ts',
        rootPath: '/project',
        impact: 'High impact',
        suggestedFix: 'Refactor',
        penalty: 30
      });

      expect(violation.message).toContain('MyClass.myMethod');
      expect(violation.message).toContain('100 lines');
      expect(violation.severity).toBe('critical');
    });

    it('should create arrow function violation with correct format', () => {
      const violation = rule['createArrowFunctionViolation']({
        rule: 'test',
        severity: 'info',
        functionName: 'myArrow',
        metric: 'nesting depth',
        metricValue: 5,
        threshold: 3,
        line: 15,
        filePath: '/project/src/file.ts',
        rootPath: '/project',
        impact: 'Low impact',
        suggestedFix: 'Simplify',
        penalty: 10
      });

      expect(violation.message).toContain('Arrow function');
      expect(violation.message).toContain('myArrow');
      expect(violation.message).toContain('nesting depth of 5 levels');
    });
  });
});
