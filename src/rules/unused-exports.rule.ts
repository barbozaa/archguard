import { Rule } from './rule-interface.js';
import { Violation, RuleContext, Severity } from '@core/types.js';
import { processSourceFiles } from './utils/rule-helpers.js';
import { Project, type SourceFile, type Node } from 'ts-morph';
import { createViolation } from './utils/violation-utils.js';

/**
 * Unused Exports Rule
 * 
 * Detects exported declarations that are never imported anywhere in the project
 * 
 * Why it matters:
 * - Unused exports indicate dead code
 * - Increases maintenance burden
 * - Can confuse developers about public API
 * - May indicate incomplete refactoring
 * 
 * Thresholds:
 * - Priority: MEDIUM (cleanup opportunity)
 * - Effort: 15-30min per export
 */
export class UnusedExportsRule implements Rule {
  name = 'unused-exports';
  severity: Severity = 'info';
  penalty = 1;

  check(context: RuleContext): Violation[] {
    const { project, config, rootPath } = context;
    const sourceFiles = project.getSourceFiles();

    // Get exclusion patterns from config
    const excludePatterns = (config.rules as any)?.[this.name]?.excludePatterns || [
      'index.ts',
      'index.tsx',
      'public-api.ts',
      'api.ts',
      '.d.ts'
    ];

    const exportMap = this.collectExports(sourceFiles, rootPath, excludePatterns);
    const importedNames = this.collectImports(sourceFiles);
    
    return this.findUnusedExports(exportMap, importedNames, sourceFiles, rootPath);
  }

  private collectExports(
    sourceFiles: ReturnType<Project['getSourceFiles']>, 
    rootPath: string, 
    excludePatterns: string[]
  ): Map<string, Map<string, { line: number; filePath: string }>> {
    const exportMap = new Map<string, Map<string, { line: number; filePath: string }>>();

    processSourceFiles(
      sourceFiles,
      rootPath,
      (sourceFile, filePath, relativePath) => {
        if (excludePatterns.some((pattern: string) => relativePath.includes(pattern))) return;

        const exports = new Map<string, { line: number; filePath: string }>();
        const exportedDeclarations = sourceFile.getExportedDeclarations();
        
        for (const [name, declarations] of exportedDeclarations) {
          if (declarations.length > 0) {
            const line = declarations[0].getStartLineNumber();
            exports.set(name, { line, filePath });
          }
        }

        if (exports.size > 0) {
          exportMap.set(relativePath, exports);
        }
      }
    );
    
    return exportMap;
  }

  private collectImports(sourceFiles: ReturnType<Project['getSourceFiles']>): Map<string, number> {
    const importedNames = new Map<string, number>();

    // We can't use processSourceFiles here because rootPath is not available
    // But we can still reduce duplication by avoiding the node_modules check
    for (const sourceFile of sourceFiles) {
      if (sourceFile.getFilePath().includes('node_modules')) continue;

      const imports = sourceFile.getImportDeclarations();
      
      for (const importDecl of imports) {
        const namedImports = importDecl.getNamedImports();
        for (const namedImport of namedImports) {
          const name = namedImport.getName();
          importedNames.set(name, (importedNames.get(name) || 0) + 1);
        }

        const defaultImport = importDecl.getDefaultImport();
        if (defaultImport) {
          const name = defaultImport.getText();
          importedNames.set(name, (importedNames.get(name) || 0) + 1);
        }
      }
    }
    return importedNames;
  }

  private findUnusedExports(
    exportMap: Map<string, Map<string, { line: number; filePath: string }>>,
    importedNames: Map<string, number>,
    sourceFiles: ReturnType<Project['getSourceFiles']>,
    rootPath: string
  ): Violation[] {
    const violations: Violation[] = [];

    for (const [relativePath, exports] of exportMap.entries()) {
      const sourceFile = sourceFiles.find(sf => {
        const sfPath = sf.getFilePath().replace(rootPath + '/', '');
        return sfPath === relativePath;
      });

      for (const [exportName, { line }] of exports) {
        if (exportName === 'default') continue;

        const importCount = importedNames.get(exportName) || 0;
        let usedLocally = false;

        if (sourceFile && importCount === 0) {
            usedLocally = this.checkLocalUsage(sourceFile, exportName);
        }
        
        if (importCount === 0 && !usedLocally) {
          violations.push(createViolation({
            rule: 'Unused Export',
            severity: 'info',
            message: `Export '${exportName}' is never imported`,
            file: relativePath,
            line,
            impact: 'Dead code that increases maintenance burden and may confuse developers',
            suggestedFix: `Remove the export if truly unused. If it's part of a public API, document it. If it's used externally, add it to exclusion patterns in config.`,
            penalty: 4
          }));
        }
      }
    }
    return violations;
  }

  private checkLocalUsage(sourceFile: SourceFile, exportName: string): boolean {
      const declarations = sourceFile.getExportedDeclarations().get(exportName);
      if (!declarations || declarations.length === 0) return false;

      const declaration = declarations[0];
      
      // For type aliases and interfaces, check if referenced in the same file
      if (declaration.getKindName() === 'TypeAliasDeclaration' || 
          declaration.getKindName() === 'InterfaceDeclaration') {
        const fileText = sourceFile.getFullText();
        // Check if type name appears elsewhere in file (as type annotation, implements, as cast)
        // Matches: ": Type", "<Type>", "extends Type", "implements Type", "as Type"
        const typeUsagePattern = new RegExp(`(:|extends|implements|as)\\s*${exportName}\\b|<\\s*${exportName}\\s*>`, 'g');
        const matches = fileText.match(typeUsagePattern);
        return matches ? matches.length > 0 : false;
      } else {
        // Type guard to check if declaration has findReferencesAsNodes method
        const hasReferences = (node: Node): node is Node & { findReferencesAsNodes(): Node[] } => {
          return 'findReferencesAsNodes' in node && typeof node.findReferencesAsNodes === 'function';
        };
        
        if (hasReferences(declaration)) {
          const references = declaration.findReferencesAsNodes();
          return references.length > 1;
        }
      }
      return false;
  }
}
