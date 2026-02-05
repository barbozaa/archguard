import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { MaxFileLinesRule } from '../../src/rules/max-file-lines.rule.js';
import { RuleContext } from '../../src/core/rule-context.js';
import { Config } from '../../src/config/config-schema.js';
import { DependencyGraph } from '../../src/core/types.js';

describe('MaxFileLinesRule', () => {
  let rule: MaxFileLinesRule;
  let project: Project;
  let config: Config;
  let graph: DependencyGraph;

  beforeEach(() => {
    rule = new MaxFileLinesRule();
    project = new Project({ useInMemoryFileSystem: true });
    config = {
      srcDirectory: '/test',
      rules: {
        maxFileLines: 100
      }
    };
    graph = {
      nodes: new Map(),
      cyclicGroups: []
    };
  });

  it('should have correct metadata', () => {
    expect(rule.name).toBe('max-file-lines');
    expect(rule.severity).toBe('warning');
    expect(rule.penalty).toBe(3);
  });

  it('should not report violations for files within limit', () => {
    const sourceFile = project.createSourceFile('/test/small.ts', `
// This is a small file
function hello() {
  return 'world';
}
    `.trim());

    const context: RuleContext = {
      project,
      graph,
      config,
      rootPath: '/test'
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(0);
  });

  it('should report violations for files exceeding limit', () => {
    // Create a file with 600 lines (exceeds default 500, should be warning)
    const lines = Array(600).fill('const x = 1;').join('\n');
    const sourceFile = project.createSourceFile('/test/large.ts', lines);

    const context: RuleContext = {
      project,
      graph,
      config,
      rootPath: '/test'
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe('Max File Lines');
    expect(violations[0].severity).toBe('warning');
    expect(violations[0].file).toBe('large.ts');
    expect(violations[0].message).toContain('600');
  });

  it('should use default threshold when not configured', () => {
    const configWithoutThreshold: Config = {
      srcDirectory: '/test'
    };

    // Create file with 501 lines (default is 500)
    const lines = Array(501).fill('const x = 1;').join('\n');
    project.createSourceFile('/test/file.ts', lines);

    const context: RuleContext = {
      project,
      graph,
      config: configWithoutThreshold,
      rootPath: '/test'
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('501');
    expect(violations[0].message).toContain('500');
  });

  it('should skip node_modules files', () => {
    const lines = Array(200).fill('const x = 1;').join('\n');
    project.createSourceFile('/test/node_modules/package/large.ts', lines);

    const context: RuleContext = {
      project,
      graph,
      config,
      rootPath: '/test'
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(0);
  });

  it('should provide helpful impact and suggested fix', () => {
    const lines = Array(150).fill('const x = 1;').join('\n');
    project.createSourceFile('/test/large.ts', lines);

    const context: RuleContext = {
      project,
      graph,
      config,
      rootPath: '/test'
    };

    const violations = rule.check(context);
    expect(violations[0].impact).toContain('harder to maintain');
    expect(violations[0].suggestedFix).toContain('Split this file');
  });
});
