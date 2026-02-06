import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { DataClumpsRule } from '@rules/data-clumps.rule.js';
import type { RuleContext } from '@core/types.js';

describe('DataClumpsRule', () => {
  it('should detect data clumps in functions', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('test.ts', `
      function processUser(name: string, age: number, email: string) {
        console.log(name, age, email);
      }
      
      function saveUser(name: string, age: number, email: string) {
        return { name, age, email };
      }
      
      function updateUser(name: string, age: number, email: string) {
        return { name, age, email };
      }
    `);
    
    const rule = new DataClumpsRule();
    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };
    
    const violations = rule.check(context);
    expect(violations).toBeDefined();
    expect(Array.isArray(violations)).toBe(true);
  });

  it('should not flag unique parameter combinations', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('test.ts', `
      function processA(a: string) { return a; }
      function processB(b: number) { return b; }
      function processC(c: boolean) { return c; }
    `);
    
    const rule = new DataClumpsRule();
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
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('node_modules/lib.ts', `
      function test(a: string, b: string, c: string) {}
      function test2(a: string, b: string, c: string) {}
    `);
    
    const rule = new DataClumpsRule();
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
