import { Rule } from './rule-interface.js';
import { Violation, RuleContext, Severity } from '@core/types.js';
import { createArchitectureViolation } from './utils/violation-utils.js';

/**
 * Detects circular dependencies in the codebase
 */
export class CircularDepsRule implements Rule {
  name = 'circular-deps';
  severity: Severity = 'critical';
  penalty = 5;

  check(context: RuleContext): Violation[] {
    const { graph, rootPath } = context;
    const violations: Violation[] = [];
    const processedCycles = new Set<string>();

    for (const cycle of graph.cyclicGroups) {
      // Create a unique signature for this cycle
      const signature = [...cycle].sort().join('->');
      
      if (processedCycles.has(signature)) {
        continue;
      }
      processedCycles.add(signature);

      if (cycle.length < 2) {
        continue;
      }

      const cycleDescription = cycle.slice(0, 3).join(' → ');
      const mainFile = cycle[0];
      const relatedFile = cycle[1];

      violations.push(createArchitectureViolation({
        rule: 'Circular Dependency',
        message: `Circular dependency detected: ${cycleDescription}${cycle.length > 3 ? '...' : ''}`,
        file: mainFile,
        relatedFile,
        rootPath,
        severity: this.severity,
        impact: 'Circular dependencies create tight coupling, make code harder to test, and can cause initialization issues. They prevent proper modularization and increase change risk.',
        suggestedFix: `Break the cycle by:\n  1. Introducing a shared abstraction/interface layer\n  2. Using dependency injection\n  3. Inverting the dependency (make one module depend on an abstraction)\n  4. Extracting shared logic into a separate module`,
        penalty: this.penalty
      }));
    }

    return violations;
  }
}
