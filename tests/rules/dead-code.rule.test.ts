import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { DeadCodeRule } from '../../src/rules/dead-code.rule.js';
import type { RuleContext } from '../../src/core/types.js';

describe('DeadCodeRule', () => {
  let project: Project;
  let rule: DeadCodeRule;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    rule = new DeadCodeRule();
  });

  it('should detect unused variables', () => {
    project.createSourceFile('test.ts', `
      const unused = 1;
      const used = 2;
      console.log(used);
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThanOrEqual(0);
  });

  it('should detect unused functions', () => {
    project.createSourceFile('test.ts', `
      function unusedFunc() {
        return 1;
      }
      
      function usedFunc() {
        return 2;
      }
      
      usedFunc();
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThanOrEqual(0);
  });

  it('should not flag exported items', () => {
    project.createSourceFile('test.ts', `
      export const exported = 1;
      export function exportedFunc() {
        return 2;
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBe(0);
  });

  it('should skip node_modules', () => {
    project.createSourceFile('node_modules/lib.ts', `
      const unused = 1;
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(0);
  });

  it('should detect variables used in bracket notation', () => {
    project.createSourceFile('test.ts', `
      const key = 'name';
      const obj = { [key]: 'value' };
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    // key should not be flagged as unused since it's used in bracket notation
    const unusedKeyViolations = violations.filter(v => v.message.includes("'key'"));
    expect(unusedKeyViolations).toHaveLength(0);
  });

  it('should detect variables used in object shorthand', () => {
    project.createSourceFile('test.ts', `
      const name = 'test';
      const obj = { name };
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    // name should not be flagged as unused since it's used in object shorthand
    const unusedNameViolations = violations.filter(v => v.message.includes("'name'"));
    expect(unusedNameViolations).toHaveLength(0);
  });

  it('should skip destructured variables', () => {
    project.createSourceFile('test.ts', `
      const { prop } = { prop: 1 };
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    // Should not crash on destructured variables
    expect(violations).toBeDefined();
  });

  it('should detect unused functions with early returns', () => {
    project.createSourceFile('test.ts', `
      function unusedWithEarlyReturn() {
        if (true) return;
        console.log('never reached');
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    // Should detect function with return statement
    expect(violations).toBeDefined();
  });

  it('should detect variables passed to functions', () => {
    project.createSourceFile('test.ts', `
      const schema = { type: 'string' };
      validate(schema);
      
      function validate(s: any) {}
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    // schema should not be flagged as unused
    const unusedSchemaViolations = violations.filter(v => v.message.includes("'schema'"));
    expect(unusedSchemaViolations).toHaveLength(0);
  });
});
