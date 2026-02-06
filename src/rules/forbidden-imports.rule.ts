import { Rule } from './rule-interface.js';
import { Violation, RuleContext, Severity } from '@core/types.js';
import { processSourceFiles } from './utils/rule-helpers.js';
import { createArchitectureViolation } from './utils/violation-utils.js';
import type { SourceFile } from 'ts-morph';

/**
 * Configuration for a forbidden import rule
 */
interface ForbiddenImportRule {
  pattern: string;
  from: string;
  reason?: string;
}

/**
 * Detects forbidden imports based on configured patterns
 * 
 * Why it matters:
 * - Prevents unwanted dependencies between modules
 * - Enforces architectural boundaries
 * - Prevents test code from leaking into production
 * - Maintains clean separation of concerns
 */
export class ForbiddenImportsRule implements Rule {
  name = 'forbidden-imports';
  severity: Severity = 'warning';
  penalty = 6;

  check(context: RuleContext): Violation[] {
    const { project, config, rootPath } = context;
    const violations: Violation[] = [];
    
    if (!config.rules?.forbiddenImports) {
      return violations;
    }

    const forbiddenRules = config.rules.forbiddenImports as ForbiddenImportRule[];

    processSourceFiles(
      project.getSourceFiles(),
      rootPath,
      (sourceFile, filePath, relativePath) => {
        this.checkFileImports(sourceFile, filePath, relativePath, rootPath, forbiddenRules, violations);
      },
      { skipTests: false, skipDeclarations: false }
    );

    return violations;
  }

  private checkFileImports(
    sourceFile: SourceFile,
    filePath: string,
    relativePath: string,
    rootPath: string,
    forbiddenRules: ForbiddenImportRule[],
    violations: Violation[]
  ): void {
    const imports = sourceFile.getImportDeclarations();

    for (const importDecl of imports) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();

      for (const rule of forbiddenRules) {
        if (!this.isForbiddenImport(moduleSpecifier, relativePath, rule)) continue;

        violations.push(createArchitectureViolation({
          rule: 'Forbidden Import',
          severity: this.severity,
          message: `Importing "${moduleSpecifier}" from "${relativePath}"`,
          file: filePath,
          relatedFile: moduleSpecifier,
          rootPath,
          impact: `This import violates project import rules. Forbidden imports can introduce unwanted dependencies, couple unrelated modules, or import test code into production.`,
          suggestedFix: `Remove this import or restructure your code:\n  1. If this is a test utility, move it to a shared test helper\n  2. If this is production code, refactor to avoid the dependency\n  3. Consider if the import rule needs updating`,
          penalty: this.penalty,
        }));
      }
    }
  }

  private isForbiddenImport(moduleSpecifier: string, filePath: string, rule: ForbiddenImportRule): boolean {
    return (
      this.matchesPattern(moduleSpecifier, rule.pattern) &&
      this.matchesPattern(filePath, rule.from)
    );
  }

  /**
   * Matches a value against a glob pattern
   * Supports: asterisk (any chars except /), double-asterisk (any chars including /)
   * 
   * Examples:
   * - "src/asterisk.ts" matches "src/file.ts" but not "src/dir/file.ts"
   * - "src/double-asterisk" matches "src/file.ts" and "src/dir/file.ts"
   * - "double-asterisk/asterisk.test.ts" matches any test.ts file in any directory
   */
  private matchesPattern(value: string, pattern: string): boolean {
    // Escape special regex characters except * and ?
    let regexPattern = pattern
      .replace(/[.+^${}()|[\\\]]/g, '\\$&')
      .replace(/\*\*/g, '\0') // Placeholder for **
      .replace(/\*/g, '[^/]*')  // * matches any char except /
      .replace(/\0/g, '.*');     // ** matches any char including /
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(value);
  }
}
