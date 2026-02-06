import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { CyclomaticComplexityRule } from '@rules/cyclomatic-complexity.rule.js';
import type { RuleContext } from '@core/types.js';

describe('CyclomaticComplexityRule', () => {
  let project: Project;
  let rule: CyclomaticComplexityRule;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    rule = new CyclomaticComplexityRule();
  });

  it('should detect high complexity in functions', () => {
    project.createSourceFile('test.ts', `
      function complexFunction(x: number) {
        if (x > 0) {
          if (x > 10) {
            for (let i = 0; i < x; i++) {
              if (i % 2 === 0) {
                console.log(i);
              }
            }
          }
        }
        return x;
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'cyclomatic-complexity': { maxComplexity: 3 } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].rule).toBe('High Cyclomatic Complexity');
    expect(violations[0].message).toContain('complexFunction');
  });

  it('should detect high complexity in methods', () => {
    project.createSourceFile('test.ts', `
      class MyClass {
        complexMethod(x: number) {
          if (x > 0 && x < 100) {
            while (x > 0) {
              if (x % 2 === 0) {
                x--;
              } else {
                x -= 2;
              }
            }
          }
          return x;
        }
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'cyclomatic-complexity': { maxComplexity: 2   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('complexMethod');
  });

  it('should detect high complexity in arrow functions', () => {
    project.createSourceFile('test.ts', `
      const complexArrow = (x: number) => {
        if (x > 0) {
          for (let i = 0; i < x; i++) {
            if (i % 2 === 0 || i % 3 === 0) {
              console.log(i);
            }
          }
        }
        return x;
      };
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'cyclomatic-complexity': { maxComplexity: 2   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('complexArrow');
  });

  it('should not flag simple functions', () => {
    project.createSourceFile('test.ts', `
      function simpleFunction(x: number) {
        return x * 2;
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'cyclomatic-complexity': { maxComplexity: 10 } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(0);
  });

  it('should count logical operators', () => {
    project.createSourceFile('test.ts', `
      function logicalFunction(a: boolean, b: boolean, c: boolean) {
        if (a && b || c) {
          return true;
        }
        return false;
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'cyclomatic-complexity': { maxComplexity: 1   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should count ternary operators', () => {
    project.createSourceFile('test.ts', `
      function ternaryFunction(x: number) {
        return x > 0 ? (x > 10 ? 'big' : 'small') : 'negative';
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'cyclomatic-complexity': { maxComplexity: 1   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should use default threshold when not configured', () => {
    project.createSourceFile('test.ts', `
      function mediumComplexity(x: number) {
        if (x > 0) {
          if (x > 10) {
            if (x > 20) {
              return 'big';
            }
          }
        }
        return 'small';
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    // Default threshold is 10, this should pass
    expect(violations).toHaveLength(0);
  });

  it('should calculate correct severity for critical complexity', () => {
    project.createSourceFile('test.ts', `
      function criticalComplexity(x: number) {
        ${Array(25).fill(0).map((_, i) => `if (x > ${i}) { x++; }`).join('\n')}
        return x;
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'cyclomatic-complexity': { maxComplexity: 5 } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].severity).toBe('critical');
  });
});
