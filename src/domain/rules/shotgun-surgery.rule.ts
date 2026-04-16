import { relative } from 'path';
import { Rule } from '@domain/rule.js';
import { Violation, Severity } from '@domain/types.js';
import { RuleContext } from '@application/rule-context.js';
import { ImportDeclaration, Project } from 'ts-morph';
import { getThresholdFromConfig, processSourceFiles } from './utils/rule-helpers.js';
import { createViolation } from './utils/violation-utils.js';

interface SymbolUsage {
  name: string;
  usedInFiles: Set<string>;
  usageCount: number;
}

/**
 * Bundles the 4 parameters that all import-tracking methods share.
 * Replaces the (importDecl, importedPath, relativePath, symbolUsages) data clump.
 */
interface ImportTrackingContext {
  importDecl: ImportDeclaration;
  importedPath: string;
  relativePath: string;
  symbolUsages: Map<string, SymbolUsage>;
}

/**
 * Detects when a single change would require modifying many files.
 * Identified by exported symbols used across more files than the configured threshold.
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

  private isUtilityModule(modulePath: string): boolean {
    const utilityPatterns = [
      '/utils/', '/helpers/', '/shared/', '/lib/', '/common/',
      'utils.ts', 'helpers.ts', 'shared.ts', 'constants.ts',
    ];
    return utilityPatterns.some(pattern => modulePath.includes(pattern));
  }

  private collectExportedSymbols(
    sourceFiles: ReturnType<Project['getSourceFiles']>,
    rootPath: string
  ): Map<string, SymbolUsage> {
    const symbolUsages = new Map<string, SymbolUsage>();

    processSourceFiles(sourceFiles, rootPath, (sourceFile, _, relativePath) => {
      for (const [name, declarations] of sourceFile.getExportedDeclarations()) {
        if (declarations.length === 0) continue;

        const kindName = declarations[0].getKindName();
        if (['InterfaceDeclaration', 'TypeAliasDeclaration', 'EnumDeclaration'].includes(kindName)) continue;

        const key = `${relativePath}::${name}`;
        if (!symbolUsages.has(key)) {
          symbolUsages.set(key, { name, usedInFiles: new Set(), usageCount: 0 });
        }
      }
    });

    return symbolUsages;
  }

  private trackImports(
    sourceFiles: ReturnType<Project['getSourceFiles']>,
    rootPath: string,
    symbolUsages: Map<string, SymbolUsage>
  ): void {
    processSourceFiles(sourceFiles, rootPath, (sourceFile, _, relativePath) => {
      for (const importDecl of sourceFile.getImportDeclarations()) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();
        if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) continue;

        const importedFile = importDecl.getModuleSpecifierSourceFile();
        if (!importedFile) continue;

        const importedPath = relative(rootPath, importedFile.getFilePath());
        const ctx: ImportTrackingContext = { importDecl, importedPath, relativePath, symbolUsages };

        // Namespace imports always tracked — indicate strong coupling regardless of module type
        this.trackNamespaceImport(ctx);

        if (!this.isUtilityModule(importedPath)) {
          this.trackNamedImports(ctx);
          this.trackDefaultImport(ctx);
        }
      }
    });
  }

  private trackNamedImports(ctx: ImportTrackingContext): void {
    for (const namedImport of ctx.importDecl.getNamedImports()) {
      const usage = ctx.symbolUsages.get(`${ctx.importedPath}::${namedImport.getName()}`);
      if (usage) {
        usage.usedInFiles.add(ctx.relativePath);
        usage.usageCount++;
      }
    }
  }

  private trackDefaultImport(ctx: ImportTrackingContext): void {
    const defaultImport = ctx.importDecl.getDefaultImport();
    if (defaultImport) {
      const usage = ctx.symbolUsages.get(`${ctx.importedPath}::default`);
      if (usage) {
        usage.usedInFiles.add(ctx.relativePath);
        usage.usageCount++;
      }
    }
  }

  private trackNamespaceImport(ctx: ImportTrackingContext): void {
    const namespaceImport = ctx.importDecl.getNamespaceImport();
    if (!namespaceImport) return;

    const key = `${ctx.importedPath}::*`;
    if (!ctx.symbolUsages.has(key)) {
      ctx.symbolUsages.set(key, { name: '*', usedInFiles: new Set(), usageCount: 0 });
    }

    const usage = ctx.symbolUsages.get(key)!;
    usage.usedInFiles.add(ctx.relativePath);
    usage.usageCount++;
  }

  private generateViolations(symbolUsages: Map<string, SymbolUsage>, threshold: number): Violation[] {
    const violations: Violation[] = [];

    for (const [key, usage] of symbolUsages.entries()) {
      const fileCount = usage.usedInFiles.size;
      if (fileCount < threshold) continue;

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

    return violations;
  }

  private getSeverityByFileCount(count: number): 'info' | 'warning' | 'critical' {
    return count >= 10 ? 'warning' : 'info';
  }

  private calculatePenalty(count: number, threshold: number): number {
    return Math.min(10, 6 + Math.floor((count - threshold) / 2));
  }
}
