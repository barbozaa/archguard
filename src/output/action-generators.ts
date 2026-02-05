/**
 * Helper functions for generating action items from violations
 */

import { Violation } from '../core/types.js';
import { getFileName } from './formatters.js';
import { NextAction } from './action-generator.js';

export function generateCircularDependencyActions(violations: Violation[]): NextAction[] {
  return violations.map(v => {
    const files = v.relatedFile 
      ? `${getFileName(v.file)} ↔ ${getFileName(v.relatedFile)}` 
      : getFileName(v.file);
    return {
      description: `Resolve circular dependency: ${files}`,
      priority: 'HIGH',
      effort: '2-4h',
      impact: 'Improves testability and reduces coupling'
    };
  });
}

export function generateLayerViolationActions(violations: Violation[]): NextAction[] {
  return violations.map(v => {
    const files = v.relatedFile 
      ? `${getFileName(v.file)} → ${getFileName(v.relatedFile)}` 
      : getFileName(v.file);
    return {
      description: `Fix layer violation: ${files}`,
      priority: 'HIGH',
      effort: '1-2h',
      impact: 'Maintains architectural boundaries'
    };
  });
}

export function generateGodFileActions(violations: Violation[]): NextAction[] {
  const godFiles = violations
    .map(v => ({
      violation: v,
      file: v.file,
      fileName: getFileName(v.file),
      lines: parseInt(v.message.match(/(\d+) lines/)?.[1] || '0')
    }))
    .sort((a, b) => b.lines - a.lines);

  return godFiles.map(item => {
    let priority: string;
    let effort: string;
    let impact: string;

    if (item.lines > 1000) {
      priority = 'HIGH';
      effort = '4-8h';
      impact = 'Significantly improves maintainability';
    } else if (item.lines > 750) {
      priority = 'MEDIUM';
      effort = '2-4h';
      impact = 'Improves modularity and code organization';
    } else {
      priority = 'LOW';
      effort = '1-2h';
      impact = 'Minor maintainability improvement';
    }

    return {
      description: `Refactor oversized file: ${item.fileName} (${item.lines} lines)`,
      priority,
      effort,
      impact,
      file: item.file,
      line: 1
    };
  });
}

export function generateTooManyImportsActions(violations: Violation[]): NextAction[] {
  const topViolations = violations
    .map(v => ({
      violation: v,
      file: v.file,
      fileName: getFileName(v.file),
      count: parseInt(v.message.match(/(\d+) imports/)?.[1] || '0')
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return topViolations.map(item => ({
    description: `Refactor high coupling: ${item.fileName} (${item.count} imports)`,
    priority: 'HIGH',
    effort: '4-8h',
    impact: 'Reduces coupling and improves modularity',
    file: item.file,
    line: 1
  }));
}

export function generateLargeFunctionActions(violations: Violation[]): NextAction[] {
  const topFunctions = violations
    .map(v => ({
      violation: v,
      file: v.file,
      name: v.message.match(/(?:Function|Method|Arrow function) '(.+?)'/)?.[1] || 
            v.message.match(/'(.+?)'/)?.[1] || 
            getFileName(v.file),
      lines: parseInt(v.message.match(/(\d+) lines/)?.[1] || '0')
    }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 3);

  return topFunctions.map(item => {
    let priority: string;
    let effort: string;
    let impact: string;

    if (item.lines > 200) {
      priority = 'HIGH';
      effort = '4-6h';
      impact = 'Significantly improves testability and comprehension';
    } else if (item.lines > 100) {
      priority = 'MEDIUM';
      effort = '2-4h';
      impact = 'Improves maintainability and reduces complexity';
    } else {
      priority = 'LOW';
      effort = '1-2h';
      impact = 'Minor maintainability improvement';
    }

    return {
      description: `Refactor large function: ${item.name} in ${getFileName(item.file)} (${item.lines} lines)`,
      priority,
      effort,
      impact,
      file: item.file,
      line: item.violation.line
    };
  });
}

export function generateDeepNestingActions(violations: Violation[]): NextAction[] {
  const topViolations = violations
    .map(v => ({
      violation: v,
      file: v.file,
      name: v.message.match(/(?:Function|Method|Arrow function) '(.+?)'/)?.[1] || 
            v.message.match(/'(.+?)'/)?.[1] || 
            getFileName(v.file),
      depth: parseInt(v.message.match(/(\d+) levels/)?.[1] || '0')
    }))
    .sort((a, b) => b.depth - a.depth)
    .slice(0, 5);

  return topViolations.map(item => {
    let priority: string;
    let effort: string;

    if (item.depth > 10) {
      priority = 'HIGH';
      effort = '3-5h';
    } else if (item.depth > 6) {
      priority = 'MEDIUM';
      effort = '2-3h';
    } else {
      priority = 'LOW';
      effort = '1-2h';
    }

    return {
      description: `Reduce nesting in ${item.name} (${getFileName(item.file)}) — ${item.depth} levels`,
      priority,
      effort,
      impact: 'Reduces complexity and improves readability',
      file: item.file,
      line: item.violation.line
    };
  });
}

// Action configuration types
interface ActionConfig {
  description: string;
  priority: string;
  effort: string;
  impact: string;
}

type ActionConfigFactory = (violations: Violation[]) => ActionConfig;

/**
 * Create action config for missing test files
 */
function createTestCoverageAction(violations: Violation[]): ActionConfig {
  const count = violations.length;
  return {
    description: `Add test coverage for ${count} untested files`,
    priority: 'MEDIUM',
    effort: `${count}-${count * 3}h`,
    impact: 'Reduces regression risk and increases code confidence'
  };
}

/**
 * Create action config for skipped tests
 */
function createSkippedTestAction(violations: Violation[]): ActionConfig {
  const count = violations.length;
  return {
    description: `Unskip and fix ${count} skipped tests`,
    priority: 'MEDIUM',
    effort: `${count}-${count * 2}h`,
    impact: 'Improves test coverage and reliability'
  };
}

/**
 * Create action config for magic numbers
 */
function createMagicNumberAction(violations: Violation[]): ActionConfig {
  const uniqueNumbers = new Set(violations.map(v => v.message.match(/Number (\S+)/)?.[1])).size;
  return {
    description: `Extract ${uniqueNumbers} magic numbers into named constants`,
    priority: 'LOW',
    effort: '4-8h',
    impact: 'Improves code clarity and maintainability'
  };
}

/**
 * Create action config for missing type annotations
 */
function createTypeAnnotationAction(violations: Violation[]): ActionConfig {
  const count = violations.length;
  const fileCount = new Set(violations.map(v => v.file)).size;
  return {
    description: `Add ${count} missing type annotations across ${fileCount} files`,
    priority: 'MEDIUM',
    effort: '3-5h',
    impact: 'Improves type safety and IDE support'
  };
}

/**
 * Generate bulk actions for violation types
 */
export function generateBulkActions(violations: Violation[], type: string): NextAction[] {
  const count = violations.length;
  if (count === 0) return [];

  const actionFactories: Record<string, ActionConfigFactory> = {
    'Missing Test File': createTestCoverageAction,
    'Skipped Test': createSkippedTestAction,
    'Magic Number': createMagicNumberAction,
    'Missing Type Annotation': createTypeAnnotationAction,
  };

  const simpleActions: Record<string, ActionConfig> = {
    'Technical Debt Marker': {
      description: `Address ${count} technical debt marker(s) (TODO/FIXME/HACK)`,
      priority: 'LOW',
      effort: '1-2h',
      impact: 'Resolves deferred work and reduces technical debt'
    },
    'Unused Export': {
      description: `Clean up ${count} unused exports`,
      priority: 'MEDIUM',
      effort: `${Math.ceil(count / 2)}-${count}h`,
      impact: 'Reduces dead code and clarifies public API'
    },
    'Wildcard Import': {
      description: `Replace ${count} wildcard imports with explicit imports`,
      priority: 'LOW',
      effort: '1-2h',
      impact: 'Improves tree-shaking and reduces bundle size'
    }
  };

  const actionConfig = actionFactories[type]?.(violations) ?? simpleActions[type];
  if (!actionConfig) return [];

  return [{
    description: actionConfig.description,
    priority: actionConfig.priority,
    effort: actionConfig.effort,
    impact: actionConfig.impact
  }];
}
