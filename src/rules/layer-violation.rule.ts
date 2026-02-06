import { Rule } from './rule-interface.js';
import { Violation, RuleContext, Severity } from '@core/types.js';
import { processSourceFiles } from './utils/rule-helpers.js';
import { createArchitectureViolation } from './utils/violation-utils.js';

/**
 * Detects layer violations based on configured architecture rules
 */
export class LayerViolationRule implements Rule {
  name = 'layer-violation';
  severity: Severity = 'critical';
  penalty = 8;

  check(context: RuleContext): Violation[] {
    const { project, graph, config, rootPath } = context;
    const violations: Violation[] = [];
    
    if (!config.rules?.layerRules) {
      return violations;
    }

    const layerRules = config.rules.layerRules;

    processSourceFiles(
      project.getSourceFiles(),
      rootPath,
      (_, filePath, relativePath) => {
        const fileLayer = this.getLayer(relativePath);

        if (!fileLayer || !layerRules[fileLayer]) {
          return;
        }

        const allowedLayers = layerRules[fileLayer];
        const node = graph.nodes.get(relativePath);

        if (!node) {
          return;
        }

        for (const dependency of node.dependencies) {
          const depLayer = this.getLayer(dependency);
          
          if (!depLayer) {
            continue;
          }

          if (!allowedLayers.includes(depLayer) && depLayer !== fileLayer) {
          // Construir paths absolutos para las factories
          const depFilePath = `${rootPath}/${dependency}`;
          
          violations.push(createArchitectureViolation({
            rule: 'Layer Violation',
            severity: this.severity,
            message: `${fileLayer} layer importing from ${depLayer} layer`,
            file: filePath,
            relatedFile: depFilePath,
            rootPath,
            impact: `Violates architectural boundaries. The ${fileLayer} layer should not depend on ${depLayer}. This breaks separation of concerns and creates unwanted coupling between layers.`,
            suggestedFix: `Restructure dependencies to follow the layer hierarchy:\n  ${fileLayer} → [${allowedLayers.join(', ')}]\n\nConsider:\n  1. Moving shared logic to an allowed layer (${allowedLayers[0] || 'domain'})\n  2. Using dependency inversion (interfaces/abstractions)\n  3. Re-evaluating if ${dependency} belongs in a different layer`,
            penalty: this.penalty,
          }));
        }
      }
      }
    );

    return violations;
  }

  private getLayer(filePath: string): string | null {
    // Extract layer from path (e.g., src/ui/... -> ui)
    const parts = filePath.split('/');
    
    // Common layer names
    const layers = ['ui', 'application', 'domain', 'infra', 'infrastructure'];
    
    for (const part of parts) {
      if (layers.includes(part.toLowerCase())) {
        return part.toLowerCase();
      }
    }

    return null;
  }
}
