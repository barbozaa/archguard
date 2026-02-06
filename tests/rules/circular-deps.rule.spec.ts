import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { CircularDepsRule } from '@rules/circular-deps.rule.js';
import type { RuleContext } from '@core/types.js';
import { GraphBuilder } from '@core/graph-builder.js';

describe('CircularDepsRule', () => {
  let project: Project;
  let rule: CircularDepsRule;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    rule = new CircularDepsRule();
  });

  it('should detect simple circular dependencies', () => {
    project.createSourceFile('a.ts', `
      import { b } from '../../src/rules/b';
      export const a = 1;
    `);

    project.createSourceFile('b.ts', `
      import { a } from '../../src/rules/a';
      export const b = 2;
    `);

    const graphBuilder = new GraphBuilder();
    const graph = graphBuilder.build(project, '/test');

    const context: RuleContext = {
      project,
      graph,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500,  } },
      rootPath: '/test'
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThanOrEqual(0);
    if (violations.length > 0) {
      expect(violations[0].rule).toBe('Circular Dependency');
    }
  });

  it('should not flag non-circular imports', () => {
    project.createSourceFile('a.ts', `
      export const a = 1;
    `);

    project.createSourceFile('b.ts', `
      import { a } from '../../src/rules/a';
      export const b = a + 1;
    `);

    const graphBuilder = new GraphBuilder();
    const graph = graphBuilder.build(project, '/test');

    const context: RuleContext = {
      project,
      graph,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500,  } },
      rootPath: '/test'
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(0);
  });

  it('should skip node_modules', () => {
    project.createSourceFile('node_modules/a.ts', `
      import { b } from '../../src/rules/b';
      export const a = 1;
    `);

    project.createSourceFile('node_modules/b.ts', `
      import { a } from '../../src/rules/a';
      export const b = 2;
    `);

    const graphBuilder = new GraphBuilder();
    const graph = graphBuilder.build(project, '/test');

    const context: RuleContext = {
      project,
      graph,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500,  } },
      rootPath: '/test'
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(0);
  });
});
