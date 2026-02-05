import { Project, SourceFile } from 'ts-morph';
import { resolve, relative } from 'path';
import { ProjectContext } from './types.js';
import { Config } from '../config/config-schema.js';
import { shouldSkipNodeModules, isTestFile } from '../rules/utils/rule-helpers.js';

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
    // Try common locations
    const candidates = [
      resolve(rootPath, 'tsconfig.json'),
      resolve(rootPath, 'src', 'tsconfig.json'),
    ];

    for (const path of candidates) {
      try {
        return path;
      } catch {
        continue;
      }
    }

    // Fallback to undefined - ts-morph will handle it
    return resolve(rootPath, 'tsconfig.json');
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
