import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { LargeFunctionRule } from '@rules/large-function.rule.js';
import type { RuleContext } from '@core/types.js';

describe('LargeFunctionRule', () => {
  let project: Project;
  let rule: LargeFunctionRule;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    rule = new LargeFunctionRule();
  });

  it('should detect large functions', () => {
    const largeFunction = `
      function largeFunction() {
        ${Array(60).fill(0).map((_, i) => `console.log(${i});`).join('\n        ')}
      }
    `;

    project.createSourceFile('test.ts', largeFunction);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'large-function': { maxLines: 50   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].rule).toBe('Large Function');
    expect(violations[0].message).toContain('largeFunction');
  });

  it('should detect large methods', () => {
    const largeMethod = `
      class MyClass {
        largeMethod() {
          ${Array(80).fill(0).map((_, i) => `console.log(${i});`).join('\n          ')}
        }
      }
    `;

    project.createSourceFile('test.ts', largeMethod);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'large-function': { maxLines: 50   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('largeMethod');
  });

  it('should detect large arrow functions', () => {
    const largeArrow = `
      const largeArrow = () => {
        ${Array(70).fill(0).map((_, i) => `console.log(${i});`).join('\n        ')}
      };
    `;

    project.createSourceFile('test.ts', largeArrow);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'large-function': { maxLines: 50   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('largeArrow');
  });

  it('should not flag small functions', () => {
    project.createSourceFile('test.ts', `
      function smallFunction() {
        return 42;
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'large-function': { maxLines: 50   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(0);
  });

  it('should ignore comments when counting lines', () => {
    project.createSourceFile('test.ts', `
      function functionWithComments() {
        // This is a comment
        /* This is a
           multiline comment */
        console.log('code');
        // Another comment
        console.log('more code');
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'large-function': { maxLines: 50   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(0);
  });

  it('should use default threshold when not configured', () => {
    const mediumFunction = `
      function mediumFunction() {
        ${Array(45).fill(0).map((_, i) => `console.log(${i});`).join('\n        ')}
      }
    `;

    project.createSourceFile('test.ts', mediumFunction);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    // Default threshold is 50, this should pass
    expect(violations).toHaveLength(0);
  });

  it('should calculate correct severity for large functions', () => {
    const veryLargeFunction = `
      function veryLargeFunction() {
        ${Array(120).fill(0).map((_, i) => `console.log(${i});`).join('\n        ')}
      }
    `;

    project.createSourceFile('test.ts', veryLargeFunction);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'large-function': { maxLines: 50   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].severity).toBe('critical');
  });
});
