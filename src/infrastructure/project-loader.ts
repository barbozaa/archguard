import { Project, SourceFile } from 'ts-morph';
import { resolve, relative } from 'path';
import { existsSync } from 'fs';
import { ProjectContext } from '@domain/types.js';
import { Config } from '@infrastructure/config/config-schema.js';
import { shouldSkipNodeModules, isTestFile } from '@domain/rules/utils/rule-helpers.js';

/**
 * Loads and parses TypeScript project using ts-morph
 */
export class ProjectLoader {
  private project: Project | null = null;

  async load(config: Config): Promise<ProjectContext> {
    const rootPath = process.cwd();
    
    // Find tsconfig.json
    const tsConfigPath = config.tsConfigPath || this.findTsConfig(rootPath);
    
    // Initialize ts-morph project
    this.project = new Project({
      tsConfigFilePath: tsConfigPath,
      skipAddingFilesFromTsConfig: false,
    });

    // If no files were loaded from tsconfig, try adding them manually
    let sourceFiles = this.project.getSourceFiles();
    if (sourceFiles.length === 0) {
      const srcDir = resolve(rootPath, config.srcDirectory);
      this.project.addSourceFilesAtPaths([
        `${srcDir}/**/*.ts`,
        `${srcDir}/**/*.tsx`,
      ]);
      sourceFiles = this.project.getSourceFiles();
    }

    const filteredFiles = this.filterSourceFiles(sourceFiles, config);

    if (filteredFiles.length === 0) {
      console.warn(`\n⚠️  Warning: No TypeScript files found in ${config.srcDirectory}`);
      console.warn(`   Check your srcDirectory setting or tsconfig.json\n`);
    }

    const sourceFilePaths = filteredFiles.map(sf => 
      relative(rootPath, sf.getFilePath())
    );

    return {
      rootPath,
      sourceFiles: sourceFilePaths,
      dependencies: new Map(),
      moduleCount: sourceFilePaths.length,
    };
  }

  getProject(): Project {
    if (!this.project) {
      throw new Error('Project not loaded. Call load() first.');
    }
    return this.project;
  }

  private findTsConfig(rootPath: string): string {
    const candidates = [
      resolve(rootPath, 'tsconfig.json'),
      resolve(rootPath, 'src', 'tsconfig.json'),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    return candidates[0];
  }

  private filterSourceFiles(
    sourceFiles: SourceFile[],
    config: Config
  ): SourceFile[] {
    const ignorePatterns = config.ignore || [];
    
    return sourceFiles.filter(sf => {
      const filePath = sf.getFilePath();
      
      // Filter out node_modules
      if (shouldSkipNodeModules(filePath)) {
        return false;
      }

      // Filter out test files by default
      if (isTestFile(filePath)) {
        return false;
      }

      // Apply custom ignore patterns
      for (const pattern of ignorePatterns) {
        if (this.matchesPattern(filePath, pattern)) {
          return false;
        }
      }

      return true;
    });
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    // Simple glob-like matching
    const regex = new RegExp(
      pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.')
    );
    return regex.test(filePath);
  }
}
