import { Node, Project, SyntaxKind } from 'ts-morph';
import { Rule } from './rule-interface.js';
import { Violation, RuleContext, Severity } from '../core/types.js';
import { processSourceFiles } from './utils/rule-helpers.js';
import { createViolation } from './utils/violation-utils.js';

/**
 * Dead Code Rule
 * 
 * Detects unreachable code and unused declarations
 * 
 * Why it matters:
 * - Increases codebase size unnecessarily
 * - Confuses developers about active code paths
 * - May indicate incomplete refactoring
 * - Wastes maintenance effort
 * 
 * Detects:
 * - Code after return/throw statements
 * - Unreachable branches (if/else with constant conditions)
 * - Unused variables (declared but never referenced)
 */
export class DeadCodeRule implements Rule {
  name = 'dead-code';
  severity: Severity = 'info';
  penalty = 4;

  check(context: RuleContext): Violation[] {
    const { project, rootPath } = context;
    const violations: Violation[] = [];

    processSourceFiles(
      project.getSourceFiles(),
      rootPath,
      (sourceFile, filePath, _) => {
        // Check for unreachable code after return/throw
        this.checkUnreachableAfterReturn(sourceFile, filePath, violations);
        
        // Check for unused variables
        this.checkUnusedVariables(sourceFile, filePath, violations);
      }
    );

    return violations;
  }

  private checkUnreachableAfterReturn(
    sourceFile: ReturnType<Project['getSourceFiles']>[0],
    filePath: string,
    violations: Violation[]
  ): void {
    const functions = [
      ...sourceFile.getFunctions(),
      ...sourceFile.getClasses().flatMap(cls => cls.getMethods()),
    ];

    for (const func of functions) {
      const body = func.getBody();
      if (!body || !Node.isBlock(body)) continue;

      const statements = body.getStatements();
      
      for (let i = 0; i < statements.length - 1; i++) {
        const statement = statements[i];
        
        // Check if this statement always exits (return, throw)
        if (this.isExitStatement(statement)) {
          const nextStatement = statements[i + 1];
          const functionName = 'getName' in func ? func.getName() : '<anonymous>';
          
          violations.push(createViolation({
            rule: 'Dead Code',
            severity: 'info',
            message: `Unreachable code after ${statement.getKindName().toLowerCase()} in '${functionName}'`,
            file: filePath,
            line: nextStatement.getStartLineNumber(),
            impact: 'Dead code increases maintenance burden and confuses developers',
            suggestedFix: 'Remove unreachable code or restructure logic to make it reachable',
            penalty: 4,
          }));
          
          break; // Only report first unreachable block per function
        }
      }
    }
  }

  private checkUnusedVariables(
    sourceFile: ReturnType<Project['getSourceFiles']>[0],
    filePath: string,
    violations: Violation[]
  ): void {
    const variableStatements = sourceFile.getVariableStatements();
    
    for (const stmt of variableStatements) {
      if (stmt.isExported()) continue;
      
      const declarations = stmt.getDeclarations();
      this.checkDeclarationsForUnusedVariables(declarations, filePath, sourceFile, violations);
    }
  }

  private checkDeclarationsForUnusedVariables(
    declarations: import('ts-morph').VariableDeclaration[],
    filePath: string,
    sourceFile: ReturnType<Project['getSourceFiles']>[0],
    violations: Violation[]
  ): void {
    for (const decl of declarations) {
      const name = decl.getName();
      
      if (this.shouldSkipVariable(name)) continue;
      
      const references = decl.findReferencesAsNodes();
      
      if (references.length !== 1) continue;
      
      const fileText = sourceFile.getFullText();
      
      if (this.isVariableUsed(name, fileText)) continue;
      
      violations.push(createViolation({
        rule: 'Dead Code',
        severity: 'info',
        message: `Variable '${name}' is declared but never used`,
        file: filePath,
        line: decl.getStartLineNumber(),
        impact: 'Unused variables add clutter and may indicate incomplete refactoring',
        suggestedFix: `Remove unused variable '${name}' or use it in the code`,
        penalty: 2,
      }));
    }
  }

  private shouldSkipVariable(name: string): boolean {
    // Skip destructured variables (complex to analyze)
    return name.includes('{') || name.includes('[');
  }

  private isVariableUsed(name: string, fileText: string): boolean {
    // Check if variable is referenced anywhere in the file (excluding the declaration itself)
    // Match word boundaries to avoid partial matches
    const usagePattern = new RegExp(`\\b${name}\\b`, 'g');
    const matches = fileText.match(usagePattern);
    
    // If used more than once (once for declaration, others for usage), it's used
    if (matches && matches.length > 1) return true;
    
    // Check if used with bracket notation (obj[var] or var[prop])
    const variableUsagePattern = new RegExp(`\\[\\s*${name}\\s*\\]|\\[\\s*['"\`]${name}['"\`]\\s*\\]|${name}\\s*\\[`, 'g');
    if (variableUsagePattern.test(fileText)) return true;
    
    // Check if used as object value or passed to function (Zod schemas, etc)
    const contextPattern = new RegExp(`[:{,]\\s*${name}\\b|\\(${name}\\)|<${name}>`, 'g');
    return contextPattern.test(fileText);
  }

  private isExitStatement(statement: Node): boolean {
    const kind = statement.getKind();
    return kind === SyntaxKind.ReturnStatement || kind === SyntaxKind.ThrowStatement;
  }
}
