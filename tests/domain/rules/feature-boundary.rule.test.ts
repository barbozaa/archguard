import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { FeatureBoundaryRule } from '@domain/rules/feature-boundary.rule.js';
import type { RuleContext } from '@domain/types.js';

function makeContext(overrides: Partial<RuleContext>): RuleContext {
  return {
    project: new Project({ useInMemoryFileSystem: true }),
    rootPath: '/test',
    graph: { nodes: new Map(), cyclicGroups: [] },
    config: { srcDirectory: '/test' },
    ...overrides,
  };
}

describe('FeatureBoundaryRule', () => {
  const rule = new FeatureBoundaryRule();

  it('should return no violations when boundaryRules is not configured', () => {
    const ctx = makeContext({});
    expect(rule.check(ctx)).toHaveLength(0);
  });

  it('should return no violations when enforce is false', () => {
    const ctx = makeContext({
      config: {
        srcDirectory: '/test',
        boundaryRules: {
          enforce: false,
          boundaries: [
            { feature: 'features/auth', allowImportsFrom: [] },
          ],
        },
      },
    });
    expect(rule.check(ctx)).toHaveLength(0);
  });

  it('should detect a boundary violation', () => {
    const ctx = makeContext({
      config: {
        srcDirectory: '/test',
        boundaryRules: {
          enforce: true,
          boundaries: [
            { feature: 'features/auth', allowImportsFrom: ['features/shared'] },
            { feature: 'features/payments', allowImportsFrom: ['features/shared'] },
            { feature: 'features/shared', allowImportsFrom: [] },
          ],
        },
      },
      graph: {
        nodes: new Map([
          ['features/auth/login.ts', {
            file: 'features/auth/login.ts',
            dependencies: new Set(['features/payments/validator.ts']),
            dependents: new Set(),
          }],
        ]),
        cyclicGroups: [],
      },
    });

    const violations = rule.check(ctx);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe('Feature Boundary');
    expect(violations[0].message).toContain('features/auth');
    expect(violations[0].message).toContain('features/payments');
    expect(violations[0].severity).toBe('critical');
  });

  it('should allow imports listed in allowImportsFrom', () => {
    const ctx = makeContext({
      config: {
        srcDirectory: '/test',
        boundaryRules: {
          enforce: true,
          boundaries: [
            { feature: 'features/auth', allowImportsFrom: ['features/shared'] },
            { feature: 'features/shared', allowImportsFrom: [] },
          ],
        },
      },
      graph: {
        nodes: new Map([
          ['features/auth/login.ts', {
            file: 'features/auth/login.ts',
            dependencies: new Set(['features/shared/utils.ts']),
            dependents: new Set(),
          }],
        ]),
        cyclicGroups: [],
      },
    });

    expect(rule.check(ctx)).toHaveLength(0);
  });

  it('should allow imports within the same feature', () => {
    const ctx = makeContext({
      config: {
        srcDirectory: '/test',
        boundaryRules: {
          enforce: true,
          boundaries: [
            { feature: 'features/auth', allowImportsFrom: [] },
          ],
        },
      },
      graph: {
        nodes: new Map([
          ['features/auth/login.ts', {
            file: 'features/auth/login.ts',
            dependencies: new Set(['features/auth/helpers.ts']),
            dependents: new Set(),
          }],
        ]),
        cyclicGroups: [],
      },
    });

    expect(rule.check(ctx)).toHaveLength(0);
  });

  it('should ignore files not matching any feature boundary', () => {
    const ctx = makeContext({
      config: {
        srcDirectory: '/test',
        boundaryRules: {
          enforce: true,
          boundaries: [
            { feature: 'features/auth', allowImportsFrom: [] },
          ],
        },
      },
      graph: {
        nodes: new Map([
          ['src/utils/helpers.ts', {
            file: 'src/utils/helpers.ts',
            dependencies: new Set(['features/auth/service.ts']),
            dependents: new Set(),
          }],
        ]),
        cyclicGroups: [],
      },
    });

    expect(rule.check(ctx)).toHaveLength(0);
  });
});
