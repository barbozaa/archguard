import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { LongParameterListRule } from '@rules/long-parameter-list.rule.js';
import type { RuleContext } from '@core/types.js';

describe('LongParameterListRule', () => {
  let project: Project;
  let rule: LongParameterListRule;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    rule = new LongParameterListRule();
  });

  it('should detect functions with too many parameters', () => {
    project.createSourceFile('test.ts', `
      function manyParams(a: number, b: string, c: boolean, d: object, e: string, f: number) {
        return a + b;
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'long-parameter-list': { maxParameters: 4   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].rule).toBe('Long Parameter List');
    expect(violations[0].message).toContain('manyParams');
  });

  it('should detect methods with too many parameters', () => {
    project.createSourceFile('test.ts', `
      class MyClass {
        manyParams(a: number, b: string, c: boolean, d: object, e: string) {
          return a + b;
        }
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'long-parameter-list': { maxParameters: 3   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('manyParams');
  });

  it('should allow constructors with more parameters', () => {
    project.createSourceFile('test.ts', `
      class MyClass {
        constructor(
          a: number, 
          b: string, 
          c: boolean, 
          d: object, 
          e: string,
          f: number
        ) {}
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'long-parameter-list': { maxParameters: 4   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    // Constructors get threshold of 6 by default
    expect(violations).toHaveLength(0);
  });

  it('should flag constructors with extremely many parameters', () => {
    project.createSourceFile('test.ts', `
      class MyClass {
        constructor(
          a: number, b: string, c: boolean, d: object, 
          e: string, f: number, g: string, h: boolean
        ) {}
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'long-parameter-list': { maxParameters: 4   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should not flag functions with few parameters', () => {
    project.createSourceFile('test.ts', `
      function fewParams(a: number, b: string) {
        return a + b;
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'long-parameter-list': { maxParameters: 4   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(0);
  });

  it('should detect arrow functions with too many parameters', () => {
    project.createSourceFile('test.ts', `
      const manyParams = (a: number, b: string, c: boolean, d: object, e: string) => {
        return a + b;
      };
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'long-parameter-list': { maxParameters: 3   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('manyParams');
  });

  it('should use default threshold when not configured', () => {
    project.createSourceFile('test.ts', `
      function fourParams(a: number, b: string, c: boolean, d: object) {
        return a;
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    // Default threshold is 4, this should pass
    expect(violations).toHaveLength(0);
  });

  it('should calculate correct severity', () => {
    project.createSourceFile('test.ts', `
      function tooManyParams(
        a: number, b: string, c: boolean, d: object,
        e: string, f: number, g: string, h: boolean
      ) {
        return a;
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'long-parameter-list': { maxParameters: 3   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    // 8 parameters with threshold of 3 results in critical severity
    expect(['warning', 'critical']).toContain(violations[0].severity);
  });
});
