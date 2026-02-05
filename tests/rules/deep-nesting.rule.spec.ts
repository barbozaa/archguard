import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { DeepNestingRule } from '../../src/rules/deep-nesting.rule.js';
import type { RuleContext } from '../../src/core/types.js';

describe('DeepNestingRule', () => {
  let project: Project;
  let rule: DeepNestingRule;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    rule = new DeepNestingRule();
  });

  it('should detect deep nesting in functions', () => {
    project.createSourceFile('test.ts', `
      function deeplyNested() {
        if (true) {
          if (true) {
            if (true) {
              if (true) {
                console.log('too deep');
              }
            }
          }
        }
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'deep-nesting': { maxDepth: 3   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].rule).toBe('Deep Nesting');
    expect(violations[0].message).toContain('deeplyNested');
  });

  it('should detect deep nesting in methods', () => {
    project.createSourceFile('test.ts', `
      class MyClass {
        deepMethod() {
          for (let i = 0; i < 10; i++) {
            while (i > 0) {
              if (i % 2 === 0) {
                switch (i) {
                  case 2:
                    console.log('deep');
                    break;
                }
              }
            }
          }
        }
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'deep-nesting': { maxDepth: 2   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('deepMethod');
  });

  it('should detect deep nesting in arrow functions', () => {
    project.createSourceFile('test.ts', `
      const deepArrow = () => {
        if (true) {
          for (let i = 0; i < 5; i++) {
            while (true) {
              try {
                console.log('nested');
              } catch (e) {
                console.error(e);
              }
            }
          }
        }
      };
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'deep-nesting': { maxDepth: 3   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('deepArrow');
  });

  it('should not flag shallow nesting', () => {
    project.createSourceFile('test.ts', `
      function shallowNesting() {
        if (true) {
          console.log('level 1');
        }
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'deep-nesting': { maxDepth: 3   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(0);
  });

  it('should count try-catch blocks', () => {
    project.createSourceFile('test.ts', `
      function withTryCatch() {
        try {
          if (true) {
            for (let i = 0; i < 5; i++) {
              while (i > 0) {
                console.log(i);
              }
            }
          }
        } catch (e) {
          console.error(e);
        }
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'deep-nesting': { maxDepth: 2   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should use default threshold when not configured', () => {
    project.createSourceFile('test.ts', `
      function mediumNesting() {
        if (true) {
          if (true) {
            if (true) {
              console.log('level 3');
            }
          }
        }
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    // Default threshold is 3, this should pass
    expect(violations).toHaveLength(0);
  });

  it('should calculate correct severity based on depth', () => {
    project.createSourceFile('test.ts', `
      function criticalNesting() {
        if (true) {
          if (true) {
            if (true) {
              if (true) {
                if (true) {
                  if (true) {
                    console.log('critical depth');
                  }
                }
              }
            }
          }
        }
      }
    `);

    const context: RuleContext = {
      project,
      config: { srcDirectory: "/test", rules: { maxFileLines: 500, 'deep-nesting': { maxDepth: 2   } } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].severity).toBe('critical');
  });
});
