import { AnalysisResult, NextAction } from '@domain/types.js';
import { groupViolationsByType } from '@presentation/utils/violation-utils.js';
import {
  generateLayerViolationActions,
  generateTooManyImportsActions,
  generateDataClumpsActions,
  generateShotgunSurgeryActions,
} from './action-generators.js';

/**
 * Generates prioritized action items from analysis results
 */
export function generateNextActions(result: AnalysisResult): NextAction[] {
  const actions: NextAction[] = [];
  const grouped = groupViolationsByType(result.violations);

  if (grouped['Layer Violation']) {
    actions.push(...generateLayerViolationActions(grouped['Layer Violation']));
  }

  if (grouped['Too Many Imports']) {
    actions.push(...generateTooManyImportsActions(grouped['Too Many Imports']));
  }

  if (grouped['Shotgun Surgery']) {
    actions.push(...generateShotgunSurgeryActions(grouped['Shotgun Surgery']));
  }

  if (grouped['Data Clumps']) {
    actions.push(...generateDataClumpsActions(grouped['Data Clumps']));
  }

  if (actions.length === 0) {
    return [{
      description: 'Continue maintaining current architecture standards',
      priority: 'LOW',
      effort: 'Ongoing',
    }];
  }

  const priorityOrder: Record<string, number> = { HIGH: 1, MEDIUM: 2, LOW: 3 };
  return actions.sort((a, b) => {
    const ap = priorityOrder[a.priority] ?? 99;
    const bp = priorityOrder[b.priority] ?? 99;
    return ap - bp;
  });
}
