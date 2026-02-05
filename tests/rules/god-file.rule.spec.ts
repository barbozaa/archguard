import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { MaxFileLinesRule } from '../../src/rules/max-file-lines.rule.js';
import type { RuleContext } from '../../src/core/types.js';

describe('MaxFileLinesRule', () => {
  let project: Project;
  let rule: MaxFileLinesRule;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    rule = new MaxFileLinesRule();
  });

  it('should detect god files', () => {
    const largeFile = `
      ${Array(600).fill(0).map((_, i) => `export const var${i} = ${i};`).join('\n')}
    `;

    project.createSourceFile('god-file.ts', largeFile);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'max-file-lines': { maxLines: 500   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].rule).toBe('Max File Lines');
    expect(violations[0].message).toContain('lines');
  });

  it('should not flag normal sized files', () => {
    const normalFile = `
      export function foo() { return 1; }
      export function bar() { return 2; }
    `;

    project.createSourceFile('normal.ts', normalFile);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'max-file-lines': { maxLines: 500   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(0);
  });

  it('should skip node_modules', () => {
    const largeFile = `
      ${Array(600).fill(0).map((_, i) => `export const var${i} = ${i};`).join('\n')}
    `;

    project.createSourceFile('node_modules/large.ts', largeFile);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'max-file-lines': { maxLines: 500   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(0);
  });

  it('should use default threshold when not configured', () => {
    const mediumFile = `
      ${Array(450).fill(0).map((_, i) => `export const var${i} = ${i};`).join('\n')}
    `;

    project.createSourceFile('medium.ts', mediumFile);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    // Default is 500, should pass
    expect(violations).toHaveLength(0);
  });

  it('should calculate correct severity', () => {
    const veryLargeFile = `
      ${Array(1100).fill(0).map((_, i) => `export const var${i} = ${i};`).join('\n')}
    `;

    project.createSourceFile('very-large.ts', veryLargeFile);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'max-file-lines': { maxLines: 500   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(['warning', 'critical']).toContain(violations[0].severity);
  });

  it('should ignore comments when counting lines', () => {
    const fileWithComments = `
      // Comment line 1
      /* Comment line 2 */
      export function foo() { return 1; }
      // Comment line 3
    `;

    project.createSourceFile('with-comments.ts', fileWithComments);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'max-file-lines': { maxLines: 500   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(0);
  });
});
