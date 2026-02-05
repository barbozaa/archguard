import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { LongParameterListRule } from '../../src/rules/long-parameter-list.rule.js';
import type { RuleContext } from '../../src/core/types.js';

describe('LongParameterListRule', () => {
  it('should detect long parameter lists', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('test.ts', `
      function tooManyParams(
        a: string,
        b: number,
        c: boolean,
        d: string,
        e: number,
        f: boolean
      ) {
        return { a, b, c, d, e, f };
      }
    `);
    
    const rule = new LongParameterListRule();
    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };
    
    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('parameter');
  });

  it('should not flag functions with few parameters', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('test.ts', `
      function okParams(a: string, b: number, c: boolean) {
        return { a, b, c };
      }
    `);
    
    const rule = new LongParameterListRule();
    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };
    
    const violations = rule.check(context);
    expect(violations.length).toBe(0);
  });

  it('should detect long constructor parameters', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('test.ts', `
      class TooManyConstructorParams {
        constructor(
          a: string,
          b: number,
          c: boolean,
          d: string,
          e: number,
          f: boolean,
          g: string
        ) {}
      }
    `);
    
    const rule = new LongParameterListRule();
    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };
    
    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should skip node_modules', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('node_modules/lib.ts', `
      function manyParams(a, b, c, d, e, f, g, h, i, j) {}
    `);
    
    const rule = new LongParameterListRule();
    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };
    
    const violations = rule.check(context);
    expect(violations.length).toBe(0);
  });
});
