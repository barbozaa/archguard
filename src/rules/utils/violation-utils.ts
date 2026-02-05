/**
 * Shared utilities for creating violations
 * Consolidated from rule-helpers.ts to eliminate duplication
 */

import { Violation, Severity } from '../../core/types.js';

/**
 * Calculate severity based on count vs threshold
 */
export function calculateSeverityByCount(
  count: number,
  thresholds: { critical: number; warning: number }
): Severity {
  if (count >= thresholds.critical) return 'critical';
  if (count >= thresholds.warning) return 'warning';
  return 'info';
}

/**
 * Calculate penalty based on how much count exceeds threshold
 */
export function calculatePenaltyByThreshold(
  count: number,
  threshold: number,
  basePenalty: number
): number {
  const excess = count - threshold;
  if (excess <= 0) return 0;
  
  const multiplier = Math.ceil(excess / threshold);
  return basePenalty * multiplier;
}

/**
 * Create a standard violation object with common defaults
 * Unified function that handles all violation types
 */
export function createViolation(params: {
  rule: string;
  severity: Severity;
  message: string;
  file: string;
  line?: number;
  relatedFile?: string;
  impact: string;
  suggestedFix: string;
  penalty: number;
}): Violation {
  const violation: Violation = {
    rule: params.rule,
    severity: params.severity,
    message: params.message,
    file: params.file,
    line: params.line ?? 1,
    impact: params.impact,
    suggestedFix: params.suggestedFix,
    penalty: params.penalty
  };
  
  if (params.relatedFile) {
    violation.relatedFile = params.relatedFile;
  }
  
  return violation;
}

/**
 * Extract threshold from rule configuration
 */
export function getThresholdFromConfig(
  ruleConfig: unknown,
  key: string = 'threshold'
): number | undefined {
  if (!ruleConfig || typeof ruleConfig !== 'object') {
    return undefined;
  }
  
  const config = ruleConfig as Record<string, unknown>;
  const value = config[key];
  
  return typeof value === 'number' ? value : undefined;
}

/**
 * Check if a file path should be skipped (node_modules)
 */
export function shouldSkipNodeModules(filePath: string): boolean {
  return filePath.includes('node_modules');
}

/**
 * Check if a file is a test file
 */
export function isTestFile(filePath: string): boolean {
  return /\.(spec|test)\.(ts|tsx|js|jsx)$/.test(filePath);
}

/**
 * Check if a file is a TypeScript declaration file
 */
export function isDeclarationFile(filePath: string): boolean {
  return filePath.endsWith('.d.ts');
}

/**
 * Convert absolute file path to relative path from project root
 */
export function getRelativePath(filePath: string, rootPath: string): string {
  // Handle special case when rootPath is just '/'
  if (rootPath === '/' || rootPath === '\\') {
    return filePath.startsWith('/') || filePath.startsWith('\\') 
      ? filePath.slice(1) 
      : filePath;
  }
  
  return filePath.replace(rootPath + '/', '').replace(rootPath + '\\', '');
}

/**
 * Factory for creating file/folder threshold violations
 * Common pattern across many rules (too-many-imports, max-file-lines, etc.)
 */
export function createThresholdViolation(params: {
  rule: string;
  message: string;
  file: string;
  rootPath: string;
  line?: number;
  severity: Severity;
  impact: string;
  suggestedFix: string;
  penalty: number;
}): Violation {
  return createViolation({
    rule: params.rule,
    severity: params.severity,
    message: params.message,
    file: getRelativePath(params.file, params.rootPath),
    line: params.line ?? 1,
    impact: params.impact,
    suggestedFix: params.suggestedFix,
    penalty: params.penalty
  });
}

/**
 * Factory for creating import/export related violations
 * Common pattern for wildcard-imports, forbidden-imports, etc.
 */
export function createImportViolation(params: {
  rule: string;
  importType: string;
  importName: string;
  file: string;
  rootPath: string;
  line: number;
  severity: Severity;
  impact: string;
  suggestedFix: string;
  penalty: number;
}): Violation {
  return createViolation({
    rule: params.rule,
    severity: params.severity,
    message: `${params.importType}: ${params.importName}`,
    file: getRelativePath(params.file, params.rootPath),
    line: params.line,
    impact: params.impact,
    suggestedFix: params.suggestedFix,
    penalty: params.penalty
  });
}

/**
 * Factory for creating architectural violations (layer violations, circular deps)
 */
export function createArchitectureViolation(params: {
  rule: string;
  message: string;
  file: string;
  relatedFile: string;
  rootPath: string;
  severity: Severity;
  impact: string;
  suggestedFix: string;
  penalty: number;
}): Violation {
  return createViolation({
    rule: params.rule,
    severity: params.severity,
    message: params.message,
    file: getRelativePath(params.file, params.rootPath),
    relatedFile: getRelativePath(params.relatedFile, params.rootPath),
    line: 1,
    impact: params.impact,
    suggestedFix: params.suggestedFix,
    penalty: params.penalty
  });
}
