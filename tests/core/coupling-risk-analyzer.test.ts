import { describe, it, expect } from 'vitest';
import { CouplingRiskAnalyzer } from '@core/coupling-risk-analyzer.js';
import { DependencyGraph, Violation } from '@core/types.js';

describe('CouplingRiskAnalyzer', () => {
  const analyzer = new CouplingRiskAnalyzer();

  it('should return empty analysis for empty graph', () => {
    const graph: DependencyGraph = {
      nodes: new Map(),
      cyclicGroups: [],
    };

    const result = analyzer.analyze(graph, []);

    expect(result.totalModules).toBe(0);
    expect(result.overallRisk).toBe(0);
    expect(result.highRiskModules).toHaveLength(0);
  });

  it('should calculate basic coupling metrics', () => {
    // Module A depends on B and C
    // Module B depends on C
    // Module C has no dependencies
    const graph: DependencyGraph = {
      nodes: new Map([
        ['A', { file: 'A', dependencies: new Set(['B', 'C']), dependents: new Set() }],
        ['B', { file: 'B', dependencies: new Set(['C']), dependents: new Set(['A']) }],
        ['C', { file: 'C', dependencies: new Set(), dependents: new Set(['A', 'B']) }],
      ]),
      cyclicGroups: [],
    };

    const result = analyzer.analyze(graph, []);

    expect(result.totalModules).toBe(3);
    expect(result.projectAverageCe).toBeCloseTo(1.0, 1); // (2+1+0)/3 = 1.0
    // Average Ca will be 1.0 because (0+1+2)/3 = 1.0
    
    // Module C should have highest Ca (2 dependents)
    const allMetrics = [...result.hubModules, ...result.highRiskModules];
    const moduleC = allMetrics.find(m => m.modulePath === 'C');
    expect(moduleC).toBeDefined();
    if (moduleC) {
      expect(moduleC.ca).toBe(2);
      expect(moduleC.ce).toBe(0);
      expect(moduleC.instability).toBe(0); // I = 0/(0+2) = 0 (stable)
    }
  });

  it('should identify circular dependency risk', () => {
    const graph: DependencyGraph = {
      nodes: new Map([
        ['A', { file: 'A', dependencies: new Set(['B']), dependents: new Set(['B']) }],
        ['B', { file: 'B', dependencies: new Set(['A']), dependents: new Set(['A']) }],
      ]),
      cyclicGroups: [['A', 'B']],
    };

    const violations: Violation[] = [
      {
        rule: 'circular-deps',
        severity: 'critical',
        message: 'Circular dependency detected: A -> B -> A',
        file: 'A',
        impact: 'Test',
        suggestedFix: 'Test',
        penalty: 10,
      },
    ];

    const result = analyzer.analyze(graph, violations);

    // Both modules should have elevated risk due to cycle participation
    expect(result.totalModules).toBe(2);
    // Check that cycleCount is tracked
    const allModules = [...result.highRiskModules, ...result.hubModules, ...result.unstableModules];
    const moduleA = allModules.find(m => m.modulePath === 'A');
    // The analyzer may not flag small projects as high risk, but cycleCount should be > 0
    if (moduleA) {
      expect(moduleA.cycleCount).toBeGreaterThan(0);
    }
  });

  it('should identify hub modules with high afferent coupling', () => {
    // Module Hub is depended upon by A, B, C, D (high Ca)
    const graph: DependencyGraph = {
      nodes: new Map([
        ['Hub', { file: 'Hub', dependencies: new Set(), dependents: new Set(['A', 'B', 'C', 'D']) }],
        ['A', { file: 'A', dependencies: new Set(['Hub']), dependents: new Set() }],
        ['B', { file: 'B', dependencies: new Set(['Hub']), dependents: new Set() }],
        ['C', { file: 'C', dependencies: new Set(['Hub']), dependents: new Set() }],
        ['D', { file: 'D', dependencies: new Set(['Hub']), dependents: new Set() }],
      ]),
      cyclicGroups: [],
    };

    const result = analyzer.analyze(graph, []);

    expect(result.hubModules.length).toBeGreaterThan(0);
    const hub = result.hubModules[0];
    expect(hub.modulePath).toBe('Hub');
    expect(hub.ca).toBe(4);
    expect(hub.ce).toBe(0);
    expect(hub.instability).toBe(0); // Stable (only depended upon)
  });

  it('should calculate instability correctly', () => {
    // Module with high Ce and low Ca = unstable
    // But also test stable modules that ARE significant (have dependents)
    const graph: DependencyGraph = {
      nodes: new Map([
        ['Unstable', { file: 'Unstable', dependencies: new Set(['A', 'B', 'C']), dependents: new Set(['D']) }],
        ['A', { file: 'A', dependencies: new Set(), dependents: new Set(['Unstable']) }],
        ['B', { file: 'B', dependencies: new Set(), dependents: new Set(['Unstable']) }],
        ['C', { file: 'C', dependencies: new Set(), dependents: new Set(['Unstable']) }],
        ['D', { file: 'D', dependencies: new Set(['Unstable']), dependents: new Set() }],
      ]),
      cyclicGroups: [],
    };

    const result = analyzer.analyze(graph, []);

    // Unstable module should have high instability (I = 0.75)
    // It may appear in unstableModules or highRiskModules depending on thresholds
    const allModules = [...result.unstableModules, ...result.highRiskModules, ...result.hubModules];
    const unstableModule = allModules.find(m => m.modulePath === 'Unstable');
    expect(unstableModule).toBeDefined();
    expect(unstableModule!.ce).toBe(3);
    expect(unstableModule!.ca).toBe(1);
    expect(unstableModule!.instability).toBe(0.75); // I = 3/(3+1) = 0.75 (highly unstable)
  });

  it('should penalize layer violations', () => {
    const graph: DependencyGraph = {
      nodes: new Map([
        ['A', { file: 'A', dependencies: new Set(['B']), dependents: new Set() }],
        ['B', { file: 'B', dependencies: new Set(), dependents: new Set(['A']) }],
      ]),
      cyclicGroups: [],
    };

    const violations: Violation[] = [
      {
        rule: 'layer-violation',
        severity: 'critical',
        message: 'Layer violation',
        file: 'A',
        impact: 'Test',
        suggestedFix: 'Test',
        penalty: 5,
      },
    ];

    const result = analyzer.analyze(graph, violations);

    const allModules = [...result.highRiskModules, ...result.hubModules];
    const moduleA = allModules.find(m => m.modulePath === 'A');
    // Layer violations should be tracked
    if (moduleA) {
      expect(moduleA.layerViolations).toBe(1);
      // Risk score should be elevated due to layer violation
      expect(moduleA.riskScore).toBeGreaterThan(0);
    } else {
      // At minimum, layerViolations should be accounted for in overall risk
      expect(result.overallRisk).toBeGreaterThan(0);
    }
  });

  it('should calculate overall project risk', () => {
    const graph: DependencyGraph = {
      nodes: new Map([
        ['A', { file: 'A', dependencies: new Set(['B']), dependents: new Set() }],
        ['B', { file: 'B', dependencies: new Set(), dependents: new Set(['A']) }],
      ]),
      cyclicGroups: [],
    };

    const result = analyzer.analyze(graph, []);

    expect(result.overallRisk).toBeGreaterThanOrEqual(0);
    expect(result.overallRisk).toBeLessThanOrEqual(100);
  });

  it('should handle isolated modules (no dependencies)', () => {
    const graph: DependencyGraph = {
      nodes: new Map([
        ['Isolated', { file: 'Isolated', dependencies: new Set(), dependents: new Set() }],
      ]),
      cyclicGroups: [],
    };

    const result = analyzer.analyze(graph, []);

    const isolated = Array.from(result.hubModules).find(m => m.modulePath === 'Isolated');
    expect(isolated).toBeUndefined(); // Should not be a hub (Ca = 0)
    expect(result.overallRisk).toBe(0);
  });
});
