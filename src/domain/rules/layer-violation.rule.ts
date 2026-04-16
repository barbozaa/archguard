import { Severity } from '@domain/types.js';
import { Config } from '@infrastructure/config/config-schema.js';
import { BoundaryRule } from './base/boundary.rule.js';
import { BoundaryClassification, BoundaryViolationParams } from './utils/graph-boundary-walker.js';

const KNOWN_LAYERS = ['ui', 'application', 'domain', 'infra', 'infrastructure'];

/**
 * Detects layer violations based on configured architecture rules.
 * Vertical boundaries: domain → application → infrastructure.
 */
export class LayerViolationRule extends BoundaryRule {
  readonly name = 'layer-violation';
  readonly severity: Severity = 'critical';
  readonly penalty = 8;

  protected isEnabled(config: Config): boolean {
    return !!config.rules?.layerRules;
  }

  protected classify(filePath: string, config: Config): BoundaryClassification | null {
    const layerRules = config.rules!.layerRules as Record<string, string[]>;
    const layer = this.getLayer(filePath);
    if (!layer || !layerRules[layer]) return null;
    return { zone: layer, allowed: layerRules[layer] };
  }

  protected violationParams(): BoundaryViolationParams {
    return {
      ruleName: 'Layer Violation',
      severity: this.severity,
      penalty: this.penalty,
      formatMessage: (src, dep) =>
        `${src} layer importing from ${dep} layer`,
      formatImpact: (src, dep) =>
        `Violates architectural boundaries. The ${src} layer should not depend on ${dep}. ` +
        `This breaks separation of concerns and creates unwanted coupling between layers.`,
      formatFix: (src, _dep, allowed) => {
        const list = Array.from(allowed);
        return `Restructure dependencies to follow the layer hierarchy:\n` +
          `  ${src} → [${list.join(', ')}]\n\nConsider:\n` +
          `  1. Moving shared logic to an allowed layer (${list[0] || 'domain'})\n` +
          `  2. Using dependency inversion (interfaces/abstractions)\n` +
          `  3. Re-evaluating if the dependency belongs in a different layer`;
      },
    };
  }

  private getLayer(filePath: string): string | null {
    for (const part of filePath.split('/')) {
      if (KNOWN_LAYERS.includes(part.toLowerCase())) {
        return part.toLowerCase();
      }
    }
    return null;
  }
}
