import { relative } from 'path';
import { Rule } from './rule-interface.js';
import { Violation, Severity } from '../core/types.js';
import { RuleContext } from '../core/rule-context.js';
import { Project } from 'ts-morph';
import { getThresholdFromConfig, processSourceFiles } from './utils/rule-helpers.js';
import { createViolation } from './utils/violation-utils.js';

interface SymbolUsage {
  name: string;
  usedInFiles: Set<string>;
  usageCount: number;
}

/**
 * Shotgun Surgery Rule
 * 
 * Detects when a single change requires modifying many files
 * Identified by symbols (classes, functions, interfaces) used across many files
 */
export class ShotgunSurgeryRule implements Rule {
  name = 'shotgun-surgery';
  severity: Severity = 'info';
  penalty = 6;

  private readonly defaultThreshold = 5;

  check(context: RuleContext): Violation[] {
    const sourceFiles = context.project.getSourceFiles();
    const ruleConfig = context.config.rules?.[this.name as keyof typeof context.config.rules];
    const threshold = getThresholdFromConfig(ruleConfig, 'minFiles') ?? this.defaultThreshold;

    const symbolUsages = this.collectExportedSymbols(sourceFiles, context.rootPath);
    this.trackImports(sourceFiles, context.rootPath, symbolUsages);

    return this.generateViolations(symbolUsages, threshold);
  }

  private collectExportedSymbols(
    sourceFiles: ReturnType<Project['getSourceFiles']>, 
    rootPath: string
  ): Map<string, SymbolUsage> {
    const symbolUsages = new Map<string, SymbolUsage>();

    processSourceFiles(
      sourceFiles,
      rootPath,
      (sourceFile, _, relativePath) => {
        const exportedDeclarations = sourceFile.getExportedDeclarations();

        for (const [name, declarations] of exportedDeclarations) {
          if (declarations.length === 0) continue;

          // Skip types, interfaces, and enums - these are contracts and expected to be widely used
          const mainDecl = declarations[0];
          const kindName = mainDecl.getKindName();
          if (['InterfaceDeclaration', 'TypeAliasDeclaration', 'EnumDeclaration'].includes(kindName)) {
              continue;
          }

          const key = `${relativePath}::${name}`;
          if (!symbolUsages.has(key)) {
            symbolUsages.set(key, {
              name,
              usedInFiles: new Set(),
              usageCount: 0,
            });
          }
        }
      }
    );
    
    return symbolUsages;
  }

  private trackImports(
    sourceFiles: ReturnType<Project['getSourceFiles']>, 
    rootPath: string,
    symbolUsages: Map<string, SymbolUsage>
  ): void {
    processSourceFiles(
      sourceFiles,
      rootPath,
      (sourceFile, _, relativePath) => {
        const imports = sourceFile.getImportDeclarations();

        for (const importDecl of imports) {
          const moduleSpecifier = importDecl.getModuleSpecifierValue();
          
          // Skip external modules
          if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) continue;

          const importedFile = importDecl.getModuleSpecifierSourceFile();
          if (!importedFile) continue;

          const importedPath = relative(rootPath, importedFile.getFilePath());
          
          this.trackNamedImports(importDecl, importedPath, relativePath, symbolUsages);
          this.trackDefaultImport(importDecl, importedPath, relativePath, symbolUsages);
          this.trackNamespaceImport(importDecl, importedPath, relativePath, symbolUsages);
        }
      }
    );
  }

  private trackNamedImports(
    importDecl: import('ts-morph').ImportDeclaration, 
    importedPath: string, 
    relativePath: string, 
    symbolUsages: Map<string, SymbolUsage>
  ): void {
    const namedImports = importDecl.getNamedImports();
    for (const namedImport of namedImports) {
      const importName = namedImport.getName();
      const key = `${importedPath}::${importName}`;
      
      const usage = symbolUsages.get(key);
      if (usage) {
        usage.usedInFiles.add(relativePath);
        usage.usageCount++;
      }
    }
  }

  private trackDefaultImport(
    importDecl: import('ts-morph').ImportDeclaration, 
    importedPath: string, 
    relativePath: string, 
    symbolUsages: Map<string, SymbolUsage>
  ): void {
    const defaultImport = importDecl.getDefaultImport();
    if (defaultImport) {
      const key = `${importedPath}::default`;
      const usage = symbolUsages.get(key);
      if (usage) {
        usage.usedInFiles.add(relativePath);
        usage.usageCount++;
      }
    }
  }
  /**
   * Track namespace imports (import * as name)
   * These indicate heavy coupling to a module's entire API
   */
  private trackNamespaceImport(
    importDecl: import('ts-morph').ImportDeclaration,
    importedPath: string,
    relativePath: string,
    symbolUsages: Map<string, SymbolUsage>
  ): void {
    const namespaceImport = importDecl.getNamespaceImport();
    if (namespaceImport) {
      const key = `${importedPath}::*`;
      
      if (!symbolUsages.has(key)) {
        symbolUsages.set(key, {
          name: '*',
          usedInFiles: new Set(),
          usageCount: 0,
        });
      }
      
      const usage = symbolUsages.get(key)!;
      usage.usedInFiles.add(relativePath);
      usage.usageCount++;
    }
  }
  private generateViolations(
    symbolUsages: Map<string, SymbolUsage>, 
    threshold: number
  ): Violation[] {
    const violations: Violation[] = [];

    for (const [key, usage] of symbolUsages.entries()) {
      const fileCount = usage.usedInFiles.size;
      
      if (fileCount >= threshold) {
        const [filePath, symbolName] = key.split('::');
        const fileList = Array.from(usage.usedInFiles).slice(0, 5).join(', ');
        
        violations.push(createViolation({
          rule: 'Shotgun Surgery',
          severity: this.getSeverityByFileCount(fileCount),
          message: `Symbol '${symbolName}' from ${filePath} is used in ${fileCount} files: ${fileList}${fileCount > 5 ? '...' : ''}`,
          file: filePath,
          line: 1,
          impact: 'Changes to this symbol require modifying many files, increasing risk and maintenance cost',
          suggestedFix: `Consider:\n  1. Introducing a facade or wrapper to reduce direct coupling\n  2. Using dependency injection to centralize usage\n  3. Extracting shared behavior into a base class or mixin\n  4. Evaluating if this is truly shared logic or duplicated code\n  5. Creating a higher-level abstraction that encapsulates this logic`,
          penalty: this.calculatePenalty(fileCount, threshold),
        }));
      }
    }
    return violations;
  }

  private getSeverityByFileCount(count: number): 'info' | 'warning' | 'critical' {
    if (count >= 10) return 'warning';
    return 'info';
  }

  private calculatePenalty(count: number, threshold: number): number {
    return Math.min(10, 6 + Math.floor((count - threshold) / 2));
  }
}
