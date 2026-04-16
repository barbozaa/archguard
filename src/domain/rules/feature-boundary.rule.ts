import { Severity } from '@domain/types.js';
import { Config } from '@infrastructure/config/config-schema.js';
import { BoundaryRule } from './base/boundary.rule.js';
import { BoundaryClassification, BoundaryViolationParams } from './utils/graph-boundary-walker.js';

interface BoundaryEntry {
  feature: string;
  allowImportsFrom: string[];
}

/**
 * Enforces feature-level isolation boundaries.
 *
 * Where layer-violation checks vertical layers (domain → application → infra),
 * this rule checks horizontal feature isolation — e.g. "features/auth" must not
 * import from "features/payments" unless explicitly allowed.
 *
 * Configuration (archguard.config.json):
 *   "boundaryRules": {
 *     "enforce": true,
 *     "boundaries": [
 *       { "feature": "features/auth",     "allowImportsFrom": ["features/shared"] },
 *       { "feature": "features/payments",  "allowImportsFrom": ["features/shared", "features/auth"] },
 *       { "feature": "features/shared",    "allowImportsFrom": [] }
 *     ]
 *   }
 *
 * Any import between two defined features that isn't in allowImportsFrom is a violation.
 * Files that don't match any declared feature are ignored.
 */
export class FeatureBoundaryRule extends BoundaryRule {
  readonly name = 'feature-boundary';
  readonly severity: Severity = 'critical';
  readonly penalty = 8;

  protected isEnabled(config: Config): boolean {
    const bc = config.boundaryRules;
    return !!bc?.enforce && Array.isArray(bc?.boundaries) && bc.boundaries.length > 0;
  }

  protected classify(filePath: string, config: Config): BoundaryClassification | null {
    const boundaries: BoundaryEntry[] = config.boundaryRules!.boundaries;
    for (const b of boundaries) {
      if (filePath.startsWith(b.feature + '/') || filePath === b.feature) {
        return { zone: b.feature, allowed: b.allowImportsFrom };
      }
    }
    return null;
  }

  protected violationParams(): BoundaryViolationParams {
    return {
      ruleName: 'Feature Boundary',
      severity: this.severity,
      penalty: this.penalty,
      formatMessage: (src, dep) =>
        `"${src}" imports from "${dep}" which is not in its allowImportsFrom`,
      formatImpact: (src, dep) =>
        `Feature isolation violated. "${src}" should not depend on "${dep}". ` +
        `This creates hidden coupling between business features and makes independent deployment or team ownership impossible.`,
      formatFix: (src, dep) =>
        `Options:\n` +
        `  1. Move the shared logic to a common module (e.g. "features/shared") and add it to allowImportsFrom\n` +
        `  2. If the dependency is intentional, add "${dep}" to the allowImportsFrom of "${src}" in archguard.config.json\n` +
        `  3. Use an event bus or mediator pattern to decouple the features`,
    };
  }
}
