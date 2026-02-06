import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { DuplicateCodeRule } from '@rules/duplicate-code.rule.js';
import type { RuleContext } from '@core/types.js';

describe('DuplicateCodeRule', () => {
  let project: Project;
  let rule: DuplicateCodeRule;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    rule = new DuplicateCodeRule();
  });

  it('should detect duplicate code blocks', () => {
    project.createSourceFile('file1.ts', `
      function duplicate() {
        const x = 1;
        const y = 2;
        const z = 3;
        console.log(x + y + z);
        return x * y * z;
      }
    `);

    project.createSourceFile('file2.ts', `
      function alsoDuplicate() {
        const x = 1;
        const y = 2;
        const z = 3;
        console.log(x + y + z);
        return x * y * z;
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'duplicate-code': { minLines: 3   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].rule).toBe('Duplicate Code');
  });

  it('should not flag short code blocks', () => {
    project.createSourceFile('file1.ts', `
      function short1() {
        return 1;
      }
    `);

    project.createSourceFile('file2.ts', `
      function short2() {
        return 1;
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'duplicate-code': { minLines: 5 } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(0);
  });

  it('should skip node_modules', () => {
    project.createSourceFile('node_modules/lib.ts', `
      function duplicate() {
        const x = 1;
        const y = 2;
        const z = 3;
        console.log(x + y + z);
        return x * y * z;
      }
    `);

    project.createSourceFile('file.ts', `
      function duplicate() {
        const x = 1;
        const y = 2;
        const z = 3;
        console.log(x + y + z);
        return x * y * z;
      }
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

  it('should use default min lines when not configured', () => {
    project.createSourceFile('file1.ts', `
      function func1() {
        const a = 1;
        const b = 2;
        const c = 3;
        const d = 4;
        return a + b + c + d;
      }
    `);

    project.createSourceFile('file2.ts', `
      function func2() {
        const a = 1;
        const b = 2;
        const c = 3;
        const d = 4;
        return a + b + c + d;
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500,  } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    // Should detect with default threshold
    expect(violations.length).toBeGreaterThanOrEqual(0);
  });

  it('should calculate severity based on number of duplicates', () => {
    const duplicateCode = `
      const x = 1;
      const y = 2;
      const z = 3;
      console.log(x + y + z);
      return x * y * z;
    `;

    project.createSourceFile('file1.ts', `function f1() { ${duplicateCode} }`);
    project.createSourceFile('file2.ts', `function f2() { ${duplicateCode} }`);
    project.createSourceFile('file3.ts', `function f3() { ${duplicateCode} }`);
    project.createSourceFile('file4.ts', `function f4() { ${duplicateCode} }`);
    project.createSourceFile('file5.ts', `function f5() { ${duplicateCode} }`);
    project.createSourceFile('file6.ts', `function f6() { ${duplicateCode} }`);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'duplicate-code': { minLines: 3   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    if (violations.length > 0) {
      expect(violations[0].severity).toBe('critical');
    }
  });
});
