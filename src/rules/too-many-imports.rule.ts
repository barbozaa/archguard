import { Rule } from './rule-interface.js';
import { Violation, RuleContext, Severity } from '../core/types.js';
import { processSourceFiles } from './utils/rule-helpers.js';
import { 
  createThresholdViolation, 
  calculateSeverityByCount, 
  calculatePenaltyByThreshold 
} from './utils/violation-utils.js';

/**
 * Too Many Imports Rule
 * 
 * Detects files with excessive import statements (>15 imports)
 * 
 * Why it matters:
 * - Indicates high coupling and poor modularity
 * - File likely violates Single Responsibility Principle
 * - Makes testing more difficult
 * - Suggests the file does too much
 * 
 * Thresholds:
 * - >25 imports: HIGH priority (severe coupling issue)
 * - 15-24 imports: MEDIUM priority (needs refactoring)
 */
export class TooManyImportsRule implements Rule {
  name = 'too-many-imports';
  severity: Severity = 'warning';
  penalty = 5;

  check(context: RuleContext): Violation[] {
    const { project, config, rootPath } = context;
    const violations: Violation[] = [];

    // Get threshold from config or use default
    const threshold = (config.rules as any)?.['too-many-imports']?.maxImports || 15;

    processSourceFiles(
      project.getSourceFiles(),
      rootPath,
      (sourceFile, _, __) => {
        // Count import declarations
        const importDeclarations = sourceFile.getImportDeclarations();
        const importCount = importDeclarations.length;

        if (importCount > threshold) {
          const severity = calculateSeverityByCount(importCount, { critical: 25, warning: 15 });
          
          violations.push(createThresholdViolation({
            rule: 'Too Many Imports',
            severity,
            message: `File has ${importCount} imports (max: ${threshold})`,
            file: sourceFile.getFilePath(),
            rootPath,
            line: 1,
            impact: 'Increases coupling, reduces modularity, and violates Single Responsibility Principle',
            suggestedFix: `Refactor file into smaller, focused modules. Remove unused imports. Consider facade pattern to reduce direct dependencies. Target: <${threshold} imports per file.`,
            penalty: calculatePenaltyByThreshold(importCount, threshold, this.penalty)
          }));
        }
      }
    );

    return violations;
  }
}
