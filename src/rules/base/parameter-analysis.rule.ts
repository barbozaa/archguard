import { SourceFile, FunctionDeclaration, MethodDeclaration, ConstructorDeclaration, ArrowFunction, VariableDeclaration, Node } from 'ts-morph';
import { relative } from 'path';
import { Rule } from '../rule-interface.js';
import { Violation, Severity } from '../../core/types.js';
import { RuleContext } from '../../core/rule-context.js';

/**
 * Base class for rules that analyze function parameters across all source files
 * Provides template methods for processing functions, methods, constructors, and arrow functions
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

  /**
   * Main check method that iterates over source files
   * Uses template method pattern to process different function types
   */
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

  /**
   * Determine if a file should be skipped during analysis
   * Override in subclasses for custom skip logic
   */
  protected shouldSkipFile(filePath: string): boolean {
    return filePath.includes('node_modules') || filePath.endsWith('.d.ts');
  }

  /**
   * Process all standalone functions in a source file
   */
  private processFunctions(sourceFile: SourceFile, relativePath: string): void {
    const functions = sourceFile.getFunctions();
    for (const func of functions) {
      this.processFunction(func, relativePath);
    }
  }

  /**
   * Process all classes (methods and constructors) in a source file
   */
  private processClasses(sourceFile: SourceFile, relativePath: string): void {
    const classes = sourceFile.getClasses();
    for (const cls of classes) {
      const className = cls.getName() || '<anonymous>';
      
      // Process constructors
      for (const ctor of cls.getConstructors()) {
        this.processConstructor(ctor, className, relativePath);
      }
      
      // Process methods
      for (const method of cls.getMethods()) {
        this.processMethod(method, className, relativePath);
      }
      
      // Process static methods (they're also methods but sometimes treated separately)
      for (const staticMethod of cls.getStaticMethods()) {
        this.processMethod(staticMethod, className, relativePath);
      }
    }
  }

  /**
   * Process all arrow functions in a source file
   */
  private processArrowFunctions(sourceFile: SourceFile, relativePath: string): void {
    const variableStatements = sourceFile.getVariableStatements();
    
    for (const stmt of variableStatements) {
      const declarations = stmt.getDeclarations();
      
      for (const decl of declarations) {
        const initializer = decl.getInitializer();
        
        if (initializer && Node.isArrowFunction(initializer)) {
          const varName = decl.getName();
          this.processArrowFunction(initializer, varName, relativePath, decl);
        }
      }
    }
  }

  // Abstract methods that subclasses must implement
  
  /**
   * Process a standalone function declaration
   */
  protected abstract processFunction(
    func: FunctionDeclaration,
    relativePath: string
  ): void;

  /**
   * Process a class method
   */
  protected abstract processMethod(
    method: MethodDeclaration,
    className: string,
    relativePath: string
  ): void;

  /**
   * Process a class constructor
   */
  protected abstract processConstructor(
    constructor: ConstructorDeclaration,
    className: string,
    relativePath: string
  ): void;

  /**
   * Process an arrow function assigned to a variable
   */
  protected abstract processArrowFunction(
    arrowFunc: ArrowFunction,
    varName: string,
    relativePath: string,
    declaration: VariableDeclaration
  ): void;

  /**
   * Get all collected violations
   */
  protected abstract getViolations(): Violation[];
}
