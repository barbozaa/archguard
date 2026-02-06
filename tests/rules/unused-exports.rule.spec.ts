import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { UnusedExportsRule } from '@rules/unused-exports.rule.js';
import type { RuleContext } from '@core/types.js';

describe('UnusedExportsRule', () => {
  let project: Project;
  let rule: UnusedExportsRule;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    rule = new UnusedExportsRule();
  });

  it('should detect unused exports', () => {
    project.createSourceFile('a.ts', `
      export const unused = 1;
      export const alsoUnused = 2;
    `);

    project.createSourceFile('b.ts', `
      const something = 42;
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500,  } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].rule).toBe('Unused Export');
  });

  it('should not flag used exports', () => {
    project.createSourceFile('a.ts', `
      export const used = 1;
    `);

    project.createSourceFile('b.ts', `
      import { used } from '../../src/rules/a';
      console.log(used);
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

  it('should skip node_modules', () => {
    project.createSourceFile('node_modules/lib.ts', `
      export const unused = 1;
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
});
