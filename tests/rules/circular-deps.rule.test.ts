import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { CircularDepsRule } from '../../src/rules/circular-deps.rule.js';
import type { RuleContext } from '../../src/core/types.js';

describe('CircularDepsRule', () => {
  it('should detect circular dependencies', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    
    project.createSourceFile('a.ts', `
      import { b } from './b';
      export const a = b + 1;
    `);
    
    project.createSourceFile('b.ts', `
      import { a } from './a';
      export const b = a + 1;
    `);

    const rule = new CircularDepsRule();
    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500, maxFileLines: 500  } },
      rootPath: '/test',
      graph: {
        nodes: new Map([
          ['a.ts', { file: 'a.ts', dependencies: new Set(['b.ts']), dependents: new Set(['b.ts']) }],
          ['b.ts', { file: 'b.ts', dependencies: new Set(['a.ts']), dependents: new Set(['a.ts']) }],
        ]),
        cyclicGroups: [['a.ts', 'b.ts']]
      }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].rule).toBe('Circular Dependency');
  });

  it('should not flag non-circular dependencies', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    
    project.createSourceFile('a.ts', `
      export const a = 1;
    `);
    
    project.createSourceFile('b.ts', `
      import { a } from './a';
      export const b = a + 1;
    `);

    const rule = new CircularDepsRule();
    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500, maxFileLines: 500  } },
      rootPath: '/test',
      graph: {
        nodes: new Map([
          ['a.ts', { file: 'a.ts', dependencies: new Set<string>(), dependents: new Set(['b.ts']) }],
          ['b.ts', { file: 'b.ts', dependencies: new Set(['a.ts']), dependents: new Set<string>() }],
        ]),
        cyclicGroups: []
      }
    };

    const violations = rule.check(context);
    expect(violations.length).toBe(0);
  });

  it('should handle complex circular dependencies', () => {
    const rule = new CircularDepsRule();
    const context: RuleContext = {
      project: new Project({ useInMemoryFileSystem: true }),
      config: { srcDirectory: '/test', rules: { maxFileLines: 500, maxFileLines: 500  } },
      rootPath: '/test',
      graph: {
        nodes: new Map([
          ['a.ts', { file: 'a.ts', dependencies: new Set(['b.ts']), dependents: new Set(['c.ts']) }],
          ['b.ts', { file: 'b.ts', dependencies: new Set(['c.ts']), dependents: new Set(['a.ts']) }],
          ['c.ts', { file: 'c.ts', dependencies: new Set(['a.ts']), dependents: new Set(['b.ts']) }],
        ]),
        cyclicGroups: [['a.ts', 'b.ts', 'c.ts']]
      }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should handle empty graph', () => {
    const rule = new CircularDepsRule();
    const context: RuleContext = {
      project: new Project({ useInMemoryFileSystem: true }),
      config: { srcDirectory: '/test', rules: { maxFileLines: 500, maxFileLines: 500  } },
      rootPath: '/test',
      graph: {
        nodes: new Map(),
        cyclicGroups: []
      }
    };

    const violations = rule.check(context);
    expect(violations.length).toBe(0);
  });

  it('should detect self-referential imports', () => {
    const rule = new CircularDepsRule();
    const context: RuleContext = {
      project: new Project({ useInMemoryFileSystem: true }),
      config: { srcDirectory: '/test', rules: { maxFileLines: 500, maxFileLines: 500  } },
      rootPath: '/test',
      graph: {
        nodes: new Map([
          ['a.ts', { file: 'a.ts', dependencies: new Set(['b.ts']), dependents: new Set(['b.ts']) }],
          ['b.ts', { file: 'b.ts', dependencies: new Set(['a.ts']), dependents: new Set(['a.ts']) }],
        ]),
        cyclicGroups: [['a.ts', 'b.ts']]
      }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should handle multiple separate cycles', () => {
    const rule = new CircularDepsRule();
    const context: RuleContext = {
      project: new Project({ useInMemoryFileSystem: true }),
      config: { srcDirectory: '/test', rules: { maxFileLines: 500, maxFileLines: 500  } },
      rootPath: '/test',
      graph: {
        nodes: new Map([
          ['a.ts', { file: 'a.ts', dependencies: new Set(['b.ts']), dependents: new Set(['b.ts']) }],
          ['b.ts', { file: 'b.ts', dependencies: new Set(['a.ts']), dependents: new Set(['a.ts']) }],
          ['c.ts', { file: 'c.ts', dependencies: new Set(['d.ts']), dependents: new Set(['d.ts']) }],
          ['d.ts', { file: 'd.ts', dependencies: new Set(['c.ts']), dependents: new Set(['c.ts']) }],
        ]),
        cyclicGroups: [['a.ts', 'b.ts'], ['c.ts', 'd.ts']]
      }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should report critical severity for cycles', () => {
    const rule = new CircularDepsRule();
    const context: RuleContext = {
      project: new Project({ useInMemoryFileSystem: true }),
      config: { srcDirectory: '/test', rules: { maxFileLines: 500, maxFileLines: 500  } },
      rootPath: '/test',
      graph: {
        nodes: new Map([
          ['a.ts', { file: 'a.ts', dependencies: new Set(['b.ts']), dependents: new Set(['b.ts']) }],
          ['b.ts', { file: 'b.ts', dependencies: new Set(['a.ts']), dependents: new Set(['a.ts']) }],
        ]),
        cyclicGroups: [['a.ts', 'b.ts']]
      }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].severity).toBe('critical');
  });
});
