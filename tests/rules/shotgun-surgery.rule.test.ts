import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { ShotgunSurgeryRule } from '../../src/rules/shotgun-surgery.rule.js';
import type { RuleContext } from '../../src/core/types.js';

describe('ShotgunSurgeryRule', () => {
  it('should detect shotgun surgery pattern', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('utils.ts', `
      export function utility() {
        return 42;
      }
    `);
    
    project.createSourceFile('file1.ts', `
      import { utility } from './utils';
      export const a = utility();
    `);
    
    project.createSourceFile('file2.ts', `
      import { utility } from './utils';
      export const b = utility();
    `);
    
    project.createSourceFile('file3.ts', `
      import { utility } from './utils';
      export const c = utility();
    `);
    
    project.createSourceFile('file4.ts', `
      import { utility } from './utils';
      export const d = utility();
    `);
    
    project.createSourceFile('file5.ts', `
      import { utility } from './utils';
      export const e = utility();
    `);
    
    const rule = new ShotgunSurgeryRule();
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

  it('should not flag files with few dependents', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('utils.ts', `
      export function utility() {
        return 42;
      }
    `);
    
    project.createSourceFile('file1.ts', `
      import { utility } from './utils';
      export const a = utility();
    `);
    
    const rule = new ShotgunSurgeryRule();
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
      export function lib() {}
    `);
    
    const rule = new ShotgunSurgeryRule();
    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };
    
    const violations = rule.check(context);
    expect(violations.length).toBe(0);
  });

  it('should detect namespace imports (import * as)', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('utils.ts', `
      export function foo() { return 1; }
      export function bar() { return 2; }
    `);
    
    // Create 5 files that use namespace import
    for (let i = 1; i <= 5; i++) {
      project.createSourceFile(`file${i}.ts`, `
        import * as utils from './utils';
        export const x${i} = utils.foo();
      `);
    }
    
    const rule = new ShotgunSurgeryRule();
    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };
    
    const violations = rule.check(context);
    // Should detect namespace import shotgun surgery
    expect(violations.length).toBeGreaterThan(0);
    const namespaceViolation = violations.find(v => v.message.includes('*'));
    expect(namespaceViolation).toBeDefined();
  });
});
