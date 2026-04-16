import { Rule } from '@domain/rule.js';
import { Violation, RuleContext, Severity } from '@domain/types.js';
import { Config } from '@infrastructure/config/config-schema.js';
import {
  walkGraphBoundaries,
  BoundaryClassification,
  BoundaryViolationParams,
} from '../utils/graph-boundary-walker.js';

/**
 * Abstract base for rules that enforce import boundaries on the dependency graph.
 * Subclasses define:
 *   - how to extract boundary config from the project config
 *   - how to classify a file path into a zone
 *   - what messages/impact/fix text to produce
 */
export abstract class BoundaryRule implements Rule {
  abstract readonly name: string;
  abstract readonly severity: Severity;
  abstract readonly penalty: number;

  check(context: RuleContext): Violation[] {
    const { graph, config, rootPath } = context;

    if (!this.isEnabled(config)) return [];

    return walkGraphBoundaries(
      graph,
      rootPath,
      (filePath) => this.classify(filePath, config),
      this.violationParams(),
    );
  }

  protected abstract isEnabled(config: Config): boolean;
  protected abstract classify(filePath: string, config: Config): BoundaryClassification | null;
  protected abstract violationParams(): BoundaryViolationParams;
}
