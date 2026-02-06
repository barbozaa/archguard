import { Rule } from './rule-interface.js';
import { Violation, RuleContext, Severity } from '@core/types.js';
import { processSourceFiles } from './utils/rule-helpers.js';
import { createThresholdViolation, calculateSeverityByCount } from './utils/violation-utils.js';

/**
 * Max File Lines Rule
 * 
 * Detects files that exceed maximum line count (God files/Monster files)
 * 
 * Why it matters:
 * - Large files violate Single Responsibility Principle
 * - Harder to navigate, understand, and maintain
 * - Difficult code reviews
 * - Often indicate poor separation of concerns
 * - Increased merge conflicts
 * 
 * Thresholds:
 * - >1000 lines: CRITICAL (urgent refactoring needed)
 * - 500-999 lines: WARNING (should refactor soon)
 * - Default max: 500 lines
 */
export class MaxFileLinesRule implements Rule {
  name = 'max-file-lines';
  severity: Severity = 'warning';
  penalty = 3;

  private static readonly DEFAULT_MAX_LINES = 500;
  private static readonly CRITICAL_THRESHOLD = 1000;
  private static readonly WARNING_THRESHOLD = 500;

  check(context: RuleContext): Violation[] {
    const { project, config, rootPath } = context;
    const violations: Violation[] = [];
    const maxLines = config.rules?.maxFileLines || MaxFileLinesRule.DEFAULT_MAX_LINES;

    processSourceFiles(
      project.getSourceFiles(),
      rootPath,
      (sourceFile) => {
        const lineCount = sourceFile.getEndLineNumber();
        
        if (lineCount > maxLines) {
          const severity = calculateSeverityByCount(lineCount, {
            critical: MaxFileLinesRule.CRITICAL_THRESHOLD,
            warning: MaxFileLinesRule.WARNING_THRESHOLD
          });

          violations.push(createThresholdViolation({
            rule: 'Max File Lines',
            severity,
            message: `File has ${lineCount} lines (max: ${maxLines})`,
            file: sourceFile.getFilePath(),
            rootPath,
            line: 1,
            impact: 'Large files are harder to maintain, test, and understand. They often indicate poor separation of concerns and violate Single Responsibility Principle.',
            suggestedFix: `Split this file into smaller, focused modules:
  1. Group related functionality into separate files
  2. Extract classes, interfaces, and utilities
  3. Organize by responsibility (e.g., services, models, utils)
  4. Consider using barrel exports (index.ts) for clean imports
  
  Target: <${maxLines} lines per file`,
            penalty: this.calculatePenalty(lineCount, maxLines)
          }));
        }
      }
    );

    return violations;
  }

  private calculatePenalty(lineCount: number, threshold: number): number {
    const excess = lineCount - threshold;
    const excessFactor = excess / threshold;
    return Math.min(10, Math.round(this.penalty + excessFactor * 5));
  }
}
