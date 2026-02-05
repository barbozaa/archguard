import { AnalysisResult } from '../core/types.js';
import { groupViolationsByType } from './utils/violation-utils.js';
import {
  generateCircularDependencyActions,
  generateLayerViolationActions,
  generateGodFileActions,
  generateTooManyImportsActions,
  generateLargeFunctionActions,
  generateDeepNestingActions,
  generateBulkActions,
} from './action-generators.js';

export interface NextAction {
  description: string;
  priority: string;
  effort: string;
  impact?: string;
  file?: string;
  line?: number;
}

/**
 * Generates prioritized action items from analysis results
 */
export function generateNextActions(result: AnalysisResult): NextAction[] {
  const actions: NextAction[] = [];
  const grouped = groupViolationsByType(result.violations);

  // High-priority structural issues
  if (grouped['Circular Dependency']) {
    actions.push(...generateCircularDependencyActions(grouped['Circular Dependency']));
  }

  if (grouped['Layer Violation']) {
    actions.push(...generateLayerViolationActions(grouped['Layer Violation']));
  }

  if (grouped['Too Many Imports']) {
    actions.push(...generateTooManyImportsActions(grouped['Too Many Imports']));
  }

  // Large code structures
  if (grouped['Large Function']) {
    actions.push(...generateLargeFunctionActions(grouped['Large Function']));
  }

  if (grouped['Deep Nesting']) {
    actions.push(...generateDeepNestingActions(grouped['Deep Nesting']));
  }

  if (grouped['God File']) {
    actions.push(...generateGodFileActions(grouped['God File']));
  }

  // Bulk actions for common issues
  const bulkActionTypes = [
    'Missing Test File',
    'Skipped Test',
    'Technical Debt Marker',
    'Unused Export',
    'Missing Type Annotation',
    'Magic Number',
    'Wildcard Import',
  ];

  bulkActionTypes.forEach(type => {
    if (grouped[type]) {
      actions.push(...generateBulkActions(grouped[type], type));
    }
  });

  // Sort actions by priority
  return sortActionsByPriority(actions);
}

function sortActionsByPriority(actions: NextAction[]): NextAction[] {
  if (actions.length === 0) {
    return [{
      description: 'Continue maintaining current architecture standards',
      priority: 'LOW',
      effort: 'Ongoing'
    }];
  }

  const priorityOrder = { 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
  return actions.sort((a, b) => {
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 99;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 99;
    return aPriority - bPriority;
  });
}
