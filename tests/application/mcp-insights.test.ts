import { describe, it, expect } from 'vitest';
import { isSafeGitRef } from '@application/diff-analyzer.js';
import {
  buildDependencyLayerMermaid,
  expandChangeNeighborhood,
  topLevelBucket,
  validateArchguardConfigJson,
  violationIdentity,
} from '@application/mcp-insights.js';
import type { DependencyGraph, DependencyNode } from '@domain/types.js';

describe('isSafeGitRef', () => {
  it('accepts typical branch and tag names', () => {
    expect(isSafeGitRef('main')).toBe(true);
    expect(isSafeGitRef('feature/foo-bar')).toBe(true);
    expect(isSafeGitRef('v1.2.3')).toBe(true);
    expect(isSafeGitRef('origin/main')).toBe(true);
  });

  it('rejects unsafe patterns', () => {
    expect(isSafeGitRef('../main')).toBe(false);
    expect(isSafeGitRef('-danger')).toBe(false);
    expect(isSafeGitRef('$(rm)')).toBe(false);
    expect(isSafeGitRef('')).toBe(false);
    expect(isSafeGitRef('a'.repeat(300))).toBe(false);
  });
});

describe('mcp-insights graph helpers', () => {
  it('violationIdentity matches diff key shape', () => {
    expect(violationIdentity({ rule: 'Layer', file: 'a.ts', message: 'x' })).toBe('Layer::a.ts::x');
  });

  it('topLevelBucket groups under src', () => {
    expect(topLevelBucket('src/domain/foo.ts')).toBe('src/domain');
    expect(topLevelBucket('src/application/x.ts')).toBe('src/application');
    expect(topLevelBucket('tests/unit/a.ts')).toBe('tests');
  });

  it('expandChangeNeighborhood adds 1-hop deps and dependents', () => {
    const a: DependencyNode = { file: 'a.ts', dependencies: new Set(['b.ts']), dependents: new Set(['c.ts']) };
    const b: DependencyNode = { file: 'b.ts', dependencies: new Set(), dependents: new Set(['a.ts']) };
    const c: DependencyNode = { file: 'c.ts', dependencies: new Set(['a.ts']), dependents: new Set() };
    const graph: DependencyGraph = {
      nodes: new Map([
        ['a.ts', a],
        ['b.ts', b],
        ['c.ts', c],
      ]),
      cyclicGroups: [],
    };
    const n = expandChangeNeighborhood(graph, ['a.ts']);
    expect(n.has('a.ts')).toBe(true);
    expect(n.has('b.ts')).toBe(true);
    expect(n.has('c.ts')).toBe(true);
  });

  it('buildDependencyLayerMermaid emits flowchart with edges', () => {
    const x: DependencyNode = {
      file: 'src/domain/x.ts',
      dependencies: new Set(['src/application/y.ts']),
      dependents: new Set(),
    };
    const y: DependencyNode = {
      file: 'src/application/y.ts',
      dependencies: new Set(),
      dependents: new Set(['src/domain/x.ts']),
    };
    const graph: DependencyGraph = {
      nodes: new Map([
        ['src/domain/x.ts', x],
        ['src/application/y.ts', y],
      ]),
      cyclicGroups: [],
    };
    const m = buildDependencyLayerMermaid(graph, 10);
    expect(m).toContain('flowchart LR');
    expect(m).toContain('src_domain');
    expect(m).toContain('src_application');
  });
});

describe('validateArchguardConfigJson', () => {
  it('accepts minimal valid config', () => {
    const r = validateArchguardConfigJson('{"srcDirectory":"./src","rules":{}}');
    expect(r.valid).toBe(true);
    expect(r.summary?.srcDirectory).toBe('./src');
  });

  it('rejects invalid JSON', () => {
    const r = validateArchguardConfigJson('{');
    expect(r.valid).toBe(false);
    expect(r.errors).toBeDefined();
  });
});
