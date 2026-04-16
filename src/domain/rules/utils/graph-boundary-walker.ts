import { DependencyGraph, Violation, Severity } from '@domain/types.js';
import { createArchitectureViolation } from './violation-utils.js';

export interface BoundaryClassification {
  zone: string;
  allowed: ReadonlySet<string> | readonly string[];
}

export interface BoundaryViolationParams {
  ruleName: string;
  severity: Severity;
  penalty: number;
  formatMessage: (sourceZone: string, depZone: string) => string;
  formatImpact: (sourceZone: string, depZone: string) => string;
  formatFix: (sourceZone: string, depZone: string, allowed: ReadonlySet<string> | readonly string[]) => string;
}

/**
 * Walks the dependency graph and reports violations where a file in one
 * zone imports from another zone that isn't in its allow list.
 *
 * Shared by LayerViolationRule (vertical) and FeatureBoundaryRule (horizontal).
 */
export function walkGraphBoundaries(
  graph: DependencyGraph,
  rootPath: string,
  classify: (filePath: string) => BoundaryClassification | null,
  params: BoundaryViolationParams,
): Violation[] {
  const violations: Violation[] = [];

  for (const [filePath, node] of graph.nodes) {
    const source = classify(filePath);
    if (!source) continue;

    const allowedSet = source.allowed instanceof Set
      ? source.allowed
      : new Set(source.allowed);

    for (const dep of node.dependencies) {
      const depClassification = classify(dep);
      if (!depClassification || depClassification.zone === source.zone) continue;

      if (!allowedSet.has(depClassification.zone)) {
        violations.push(createArchitectureViolation({
          rule: params.ruleName,
          severity: params.severity,
          message: params.formatMessage(source.zone, depClassification.zone),
          file: `${rootPath}/${filePath}`,
          relatedFile: `${rootPath}/${dep}`,
          rootPath,
          impact: params.formatImpact(source.zone, depClassification.zone),
          suggestedFix: params.formatFix(source.zone, depClassification.zone, source.allowed),
          penalty: params.penalty,
        }));
      }
    }
  }

  return violations;
}
