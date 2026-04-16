import { SourceFile, FunctionDeclaration, MethodDeclaration, ConstructorDeclaration, ArrowFunction, VariableDeclaration, Node } from 'ts-morph';
import { relative } from 'path';
import { Rule } from '@domain/rule.js';
import { Violation, Severity } from '@domain/types.js';
import { RuleContext } from '@application/rule-context.js';

/**
 * Scope information for a class member (method or constructor).
 * Replaces the (className, relativePath) data clump.
 */
export interface ClassMemberScope {
  className: string;
  relativePath: string;
}

/**
 * Base class for rules that analyze function parameters across all source files.
 * Provides template methods for processing functions, methods, constructors, and arrow functions.
 *
 * Subclasses must implement:
 * - processFunction(): Analyze a standalone function
 * - processMethod(): Analyze a class method
 * - processConstructor(): Analyze a class constructor
 * - processArrowFunction(): Analyze an arrow function
 * - getViolations(): Return collected violations
 */
export abstract class ParameterAnalysisRule implements Rule {
  abstract name: string;
  abstract severity: Severity;
  abstract penalty: number;

  check(context: RuleContext): Violation[] {
    const sourceFiles = context.project.getSourceFiles();

    for (const sourceFile of sourceFiles) {
      if (this.shouldSkipFile(sourceFile.getFilePath())) continue;

      const relativePath = relative(context.rootPath, sourceFile.getFilePath());

      this.processFunctions(sourceFile, relativePath);
      this.processClasses(sourceFile, relativePath);
      this.processArrowFunctions(sourceFile, relativePath);
    }

    return this.getViolations();
  }

  protected shouldSkipFile(filePath: string): boolean {
    return filePath.includes('node_modules') || filePath.endsWith('.d.ts');
  }

  private processFunctions(sourceFile: SourceFile, relativePath: string): void {
    for (const func of sourceFile.getFunctions()) {
      this.processFunction(func, relativePath);
    }
  }

  private processClasses(sourceFile: SourceFile, relativePath: string): void {
    for (const cls of sourceFile.getClasses()) {
      const scope: ClassMemberScope = {
        className: cls.getName() ?? '<anonymous>',
        relativePath,
      };

      for (const ctor of cls.getConstructors()) {
        this.processConstructor(ctor, scope);
      }
      for (const method of [...cls.getMethods(), ...cls.getStaticMethods()]) {
        this.processMethod(method, scope);
      }
    }
  }

  private processArrowFunctions(sourceFile: SourceFile, relativePath: string): void {
    for (const stmt of sourceFile.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        const initializer = decl.getInitializer();
        if (initializer && Node.isArrowFunction(initializer)) {
          this.processArrowFunction(initializer, decl.getName(), relativePath, decl);
        }
      }
    }
  }

  protected abstract processFunction(func: FunctionDeclaration, relativePath: string): void;
  protected abstract processMethod(method: MethodDeclaration, scope: ClassMemberScope): void;
  protected abstract processConstructor(constructor: ConstructorDeclaration, scope: ClassMemberScope): void;
  protected abstract processArrowFunction(
    arrowFunc: ArrowFunction,
    varName: string,
    relativePath: string,
    declaration: VariableDeclaration
  ): void;
  protected abstract getViolations(): Violation[];
}
