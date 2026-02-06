import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { TooManyImportsRule } from '@rules/too-many-imports.rule.js';
import type { RuleContext } from '@core/types.js';

describe('TooManyImportsRule', () => {
  let project: Project;
  let rule: TooManyImportsRule;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    rule = new TooManyImportsRule();
  });

  it('should detect files with too many imports', () => {
    const imports = Array(25).fill(0).map((_, i) => `import { func${i} } from '../../src/rules/module${i}';`).join('\n');
    
    project.createSourceFile('test.ts', `
      ${imports}
      console.log('test');
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'too-many-imports': { maxImports: 15   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].rule).toBe('Too Many Imports');
  });

  it('should not flag files with few imports', () => {
    project.createSourceFile('test.ts', `
      import { foo } from '../../src/rules/foo';
      import { bar } from '../../src/rules/bar';
      console.log(foo, bar);
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'too-many-imports': { maxImports: 15   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(0);
  });

  it('should skip node_modules', () => {
    const imports = Array(25).fill(0).map((_, i) => `import { func${i} } from '../../src/rules/module${i}';`).join('\n');
    
    project.createSourceFile('node_modules/test.ts', `
      ${imports}
      console.log('test');
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'too-many-imports': { maxImports: 15   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(0);
  });

  it('should use default threshold when not configured', () => {
    const imports = Array(10).fill(0).map((_, i) => `import { func${i} } from '../../src/rules/module${i}';`).join('\n');
    
    project.createSourceFile('test.ts', `
      ${imports}
      console.log('test');
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    // Default threshold is typically 20, so 10 imports should be fine
    expect(violations).toHaveLength(0);
  });
});
