import { describe, it, expect } from 'vitest';
import { walkGraphBoundaries, BoundaryClassification } from '@domain/rules/utils/graph-boundary-walker.js';
import type { DependencyGraph } from '@domain/types.js';

function makeGraph(edges: Record<string, string[]>): DependencyGraph {
  const nodes = new Map<string, { file: string; dependencies: Set<string>; dependents: Set<string> }>();

  for (const [file, deps] of Object.entries(edges)) {
    if (!nodes.has(file)) {
      nodes.set(file, { file, dependencies: new Set(), dependents: new Set() });
    }
    for (const dep of deps) {
      nodes.get(file)!.dependencies.add(dep);
      if (!nodes.has(dep)) {
        nodes.set(dep, { file: dep, dependencies: new Set(), dependents: new Set() });
      }
      nodes.get(dep)!.dependents.add(file);
    }
  }

  return { nodes, cyclicGroups: [] };
}

const defaultParams = {
  ruleName: 'Test Rule',
  severity: 'critical' as const,
  penalty: 5,
  formatMessage: (src: string, dep: string) => `${src} -> ${dep}`,
  formatImpact: () => 'test impact',
  formatFix: () => 'test fix',
};

describe('walkGraphBoundaries', () => {
  it('should return empty when no nodes match any zone', () => {
    const graph = makeGraph({ 'lib/foo.ts': ['lib/bar.ts'] });
    const classify = () => null;

    const violations = walkGraphBoundaries(graph, '/root', classify, defaultParams);
    expect(violations).toHaveLength(0);
  });

  it('should detect cross-zone violation', () => {
    const graph = makeGraph({ 'zone-a/foo.ts': ['zone-b/bar.ts'] });
    const classify = (path: string): BoundaryClassification | null => {
      if (path.startsWith('zone-a/')) return { zone: 'A', allowed: [] };
      if (path.startsWith('zone-b/')) return { zone: 'B', allowed: [] };
      return null;
    };

    const violations = walkGraphBoundaries(graph, '/root', classify, defaultParams);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toBe('A -> B');
  });

  it('should allow same-zone dependencies', () => {
    const graph = makeGraph({ 'zone-a/foo.ts': ['zone-a/bar.ts'] });
    const classify = (path: string): BoundaryClassification | null => {
      if (path.startsWith('zone-a/')) return { zone: 'A', allowed: [] };
      return null;
    };

    const violations = walkGraphBoundaries(graph, '/root', classify, defaultParams);
    expect(violations).toHaveLength(0);
  });

  it('should allow dependencies in the allowed set', () => {
    const graph = makeGraph({ 'zone-a/foo.ts': ['zone-b/bar.ts'] });
    const classify = (path: string): BoundaryClassification | null => {
      if (path.startsWith('zone-a/')) return { zone: 'A', allowed: ['B'] };
      if (path.startsWith('zone-b/')) return { zone: 'B', allowed: [] };
      return null;
    };

    const violations = walkGraphBoundaries(graph, '/root', classify, defaultParams);
    expect(violations).toHaveLength(0);
  });

  it('should handle ReadonlySet in allowed', () => {
    const graph = makeGraph({ 'zone-a/foo.ts': ['zone-b/bar.ts'] });
    const classify = (path: string): BoundaryClassification | null => {
      if (path.startsWith('zone-a/')) return { zone: 'A', allowed: new Set(['B']) };
      if (path.startsWith('zone-b/')) return { zone: 'B', allowed: new Set() };
      return null;
    };

    const violations = walkGraphBoundaries(graph, '/root', classify, defaultParams);
    expect(violations).toHaveLength(0);
  });
});
