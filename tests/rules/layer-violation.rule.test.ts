import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { LayerViolationRule } from '@rules/layer-violation.rule.js';
import type { RuleContext } from '@core/types.js';

describe('LayerViolationRule', () => {
  it('should detect layer violations', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('/test/src/ui/component.ts', `
      import { db } from '../infrastructure/database';
      export const Component = () => db.query();
    `);

    const rule = new LayerViolationRule();
    const context: RuleContext = {
      project,
      config: {
        srcDirectory: '/test',
        rules: {
          maxFileLines: 500,
          layerRules: {
            'ui': ['application'],
            'application': ['domain'],
            'domain': [],
            'infrastructure': []
           }
        }
      },
      rootPath: '/test',
      graph: {
        nodes: new Map([
          ['src/ui/component.ts', { file: 'src/ui/component.ts', dependencies: new Set(['src/infrastructure/database.ts']), dependents: new Set() }]
        ]),
        cyclicGroups: []
      }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('layer');
  });

  it('should allow correct layer dependencies', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('/test/src/ui/component.ts', `
      import { service } from '../domain/service';
      export const Component = () => service.execute();
    `);

    const rule = new LayerViolationRule();
    const context: RuleContext = {
      project,
      config: {
        srcDirectory: '/test',
        rules: {
          maxFileLines: 500,
          layerRules: {
            'ui': ['domain'],
            'domain': ['data'],
            'data': []
          }
        }
      },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBe(0);
  });

  it('should handle no layer rules config', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('test.ts', `
      import { something } from './other';
      export const x = something;
    `);

    const rule = new LayerViolationRule();
    const context: RuleContext = {
      project,
      config: { srcDirectory: '/test', rules: { maxFileLines: 500 } },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBe(0);
  });

  it('should detect transitive violations', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('/test/src/ui/view.ts', `
      import { db } from '../infrastructure/database';
      export const view = () => db.query();
    `);

    const rule = new LayerViolationRule();
    const context: RuleContext = {
      project,
      config: {
        srcDirectory: '/test',
        rules: {
          maxFileLines: 500,
          layerRules: {
            'ui': ['application'],
            'application': ['domain'],
            'domain': [],
            'infrastructure': []
           }
        }
      },
      rootPath: '/test',
      graph: {
        nodes: new Map([
          ['src/ui/view.ts', { file: 'src/ui/view.ts', dependencies: new Set(['src/infrastructure/database.ts']), dependents: new Set() }]
        ]),
        cyclicGroups: []
      }
    };

    const violations = rule.check(context);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should skip node_modules', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('node_modules/lib/test.ts', `
      import { something } from '../other';
      export const x = something;
    `);

    const rule = new LayerViolationRule();
    const context: RuleContext = {
      project,
      config: {
        srcDirectory: '/test',
        rules: {
          maxFileLines: 500,
          layerRules: {
            'ui': ['domain']
           }
        }
      },
      rootPath: '/test',
      graph: { nodes: new Map(), cyclicGroups: [] }
    };

    const violations = rule.check(context);
    expect(violations.length).toBe(0);
  });
});
