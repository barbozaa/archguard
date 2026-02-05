import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { ForbiddenImportsRule } from '../../src/rules/forbidden-imports.rule.js';
import type { RuleContext } from '../../src/core/types.js';

describe('ForbiddenImportsRule', () => {
  it('should detect forbidden imports', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('test.ts', `
      import { something } from 'lodash';
      export const x = something;
    `);

    const rule = new ForbiddenImportsRule();
    const context: RuleContext = {
      project,
      config: {
        srcDirectory: '/test',
        rules: {
          maxFileLines: 500,
          forbiddenImports: [
            { pattern: 'lodash', from: '**/*.ts' }
          ]
        }
      },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('lodash');
  });

  it('should allow non-forbidden imports', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('test.ts', `
      import { React } from 'react';
      export const Component = () => null;
    `);

    const rule = new ForbiddenImportsRule();
    const context: RuleContext = {
      project,
      config: {
        srcDirectory: '/test',
        rules: {
          maxFileLines: 500,
          forbiddenImports: [
            { pattern: 'lodash', from: '**/*.ts' }
          ]
        }
      },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBe(0);
  });

  it('should respect from pattern', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('src/api/test.ts', `
      import { axios } from 'axios';
      export const api = axios;
    `);
    
    project.createSourceFile('src/ui/component.ts', `
      import { axios } from 'axios';
      export const fetch = axios;
    `);

    const rule = new ForbiddenImportsRule();
    const context: RuleContext = {
      project,
      config: {
        srcDirectory: '/',
        rules: {
          maxFileLines: 500,
          forbiddenImports: [
            { pattern: 'axios', from: 'src/ui/**' }
          ]
        }
      },
      rootPath: '/',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].file).toContain('ui');
  });

  it('should handle no forbidden imports config', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('test.ts', `
      import { something } from 'anything';
      export const x = something;
    `);

    const rule = new ForbiddenImportsRule();
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
    project.createSourceFile('node_modules/lib/test.ts', `
      import { lodash } from 'lodash';
      export const x = lodash;
    `);

    const rule = new ForbiddenImportsRule();
    const context: RuleContext = {
      project,
      config: {
        srcDirectory: '/test',
        rules: {
          maxFileLines: 500,
          forbiddenImports: [
            { pattern: 'lodash', from: '**/*.ts' }
          ]
        }
      },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBe(0);
  });

  it('should handle complex glob patterns correctly', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    
    // Test file that should match **/*.test.ts pattern
    project.createSourceFile('src/deep/file.test.ts', `
      import { test } from './test-utils';
      export const x = test;
    `);

    const rule = new ForbiddenImportsRule();
    const context: RuleContext = {
      project,
      config: {
        srcDirectory: '/',
        rules: {
          maxFileLines: 500,
          forbiddenImports: [
            // Should match any .test.ts file importing test-utils
            { pattern: './test-utils', from: '**/*.test.ts' }
          ]
        }
      },
      rootPath: '/',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    // Should catch the test file importing test-utils
    expect(violations.length).toBe(1);
    expect(violations[0].file).toContain('file.test.ts');
    expect(violations[0].message).toContain('test-utils');
  });
});
