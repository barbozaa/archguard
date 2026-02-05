/**
 * Base utilities for rule implementations
 * Re-exports from violation-utils for backward compatibility
 */

import { SourceFile } from 'ts-morph';

// Re-export all utilities from violation-utils to maintain backward compatibility
export {
  createViolation,
  getThresholdFromConfig,
  shouldSkipNodeModules,
  isTestFile,
  isDeclarationFile,
  getRelativePath
} from './violation-utils.js';

/**
 * Callback for processing each source file
 */
export type SourceFileProcessor = (
  sourceFile: SourceFile,
  filePath: string,
  relativePath: string
) => void;

/**
 * Options for processing source files
 */
export interface ProcessSourceFilesOptions {
  skipNodeModules?: boolean;
  skipTests?: boolean;
  onlyTests?: boolean;
  skipDeclarations?: boolean;
  customSkipCheck?: (filePath: string) => boolean;
}

/**
 * Process source files with common skip logic
 * Reduces duplication of the common for-loop pattern
 */
export function processSourceFiles(
  sourceFiles: SourceFile[],
  rootPath: string,
  processor: SourceFileProcessor,
  options: ProcessSourceFilesOptions = {}
): void {
  const {
    skipNodeModules = true,
    skipTests = false,
    onlyTests = false,
    skipDeclarations = true,
    customSkipCheck
  } = options;

  for (const sourceFile of sourceFiles) {
    const filePath = sourceFile.getFilePath();
    
    if (shouldSkipSourceFile(filePath, { skipNodeModules, skipTests, onlyTests, skipDeclarations, customSkipCheck })) {
      continue;
    }
    
    const relativePath = getRelativePath(filePath, rootPath);
    processor(sourceFile, filePath, relativePath);
  }
}

/**
 * Check if a source file should be skipped based on various criteria
 * Refactored to reduce cyclomatic complexity
 */
function shouldSkipSourceFile(
  filePath: string, 
  options: {
    skipNodeModules: boolean;
    skipTests: boolean;
    onlyTests: boolean;
    skipDeclarations: boolean;
    customSkipCheck?: (filePath: string) => boolean;
  }
): boolean {
  // Define skip checks as an array of conditions
  const skipChecks = [
    { condition: options.skipNodeModules, test: () => shouldSkipNodeModules(filePath) },
    { condition: options.onlyTests, test: () => !isTestFile(filePath) },
    { condition: options.skipTests, test: () => isTestFile(filePath) },
    { condition: options.skipDeclarations, test: () => isDeclarationFile(filePath) },
    { condition: !!options.customSkipCheck, test: () => options.customSkipCheck!(filePath) }
  ];
  
  // Check each condition
  for (const { condition, test } of skipChecks) {
    if (condition && test()) {
      return true;
    }
  }
  
  return false;
}

// Import helper functions
import { shouldSkipNodeModules, isTestFile, isDeclarationFile, getRelativePath } from './violation-utils.js';
