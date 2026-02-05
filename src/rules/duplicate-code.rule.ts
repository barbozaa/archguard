import { Rule } from './rule-interface.js';
import { Severity, Violation } from '../core/types.js';
import { RuleContext } from '../core/rule-context.js';
import { processSourceFiles } from './utils/rule-helpers.js';
import { createViolation } from './utils/violation-utils.js';

interface CodeLocation {
  file: string;
  line: number;
  code: string;
}

/**
 * Duplicate Code Rule
 * 
 * Detects similar code blocks that appear in multiple files
 * Uses a simple hash-based approach for performance
 * 
 * Why it matters:
 * - Duplicated code increases maintenance burden
 * - Changes must be made in multiple places
 * - Increases likelihood of bugs
 * - Violates DRY (Don't Repeat Yourself) principle
 * 
 * Thresholds:
 * - 3+ duplicates: HIGH priority
 * - 2 duplicates: MEDIUM priority
 */

// Penalty scores - significantly reduced for fairer scoring
const CRITICAL_PENALTY = 2;  // Was 8, then 4
const WARNING_PENALTY = 1;   // Was 4, then 2
const INFO_PENALTY = 0.5;    // Was 2, then 1

// Thresholds for duplicate detection
const MIN_DUPLICATE_LINES = 5;
const CRITICAL_FILE_COUNT_THRESHOLD = 5;
const WARNING_FILE_COUNT_THRESHOLD = 3;

export class DuplicateCodeRule implements Rule {
  name = 'duplicate-code';
  severity: Severity = 'warning';
  penalty = INFO_PENALTY;

  private readonly minLines = MIN_DUPLICATE_LINES;

  check(context: RuleContext): Violation[] {
    const sourceFiles = context.project.getSourceFiles();

    // Get config
    const ruleConfig = context.config.rules?.[this.name as keyof typeof context.config.rules];
    let minLines = this.minLines;
    
    if (ruleConfig && typeof ruleConfig === 'object' && 'minLines' in ruleConfig) {
      const configMinLines = (ruleConfig as Record<string, unknown>).minLines;
      if (typeof configMinLines === 'number') {
        minLines = configMinLines;
      }
    }

    const codeBlocks = this.collectCodeBlocks(sourceFiles, context.rootPath, minLines);
    return this.generateViolations(codeBlocks);
  }

  private collectCodeBlocks(
      sourceFiles: import('ts-morph').SourceFile[], 
      rootPath: string, 
      minLines: number
  ): Map<string, CodeLocation[]> {
    const codeBlocks = new Map<string, CodeLocation[]>();

    processSourceFiles(
      sourceFiles,
      rootPath,
      (sourceFile, _, relativePath) => {
        const lines = sourceFile.getFullText().split('\n');

        // Extract code blocks
        for (let i = 0; i <= lines.length - minLines; i++) {
          const block = lines.slice(i, i + minLines);
          const normalized = this.normalizeCode(block);
          
          // Skip blocks that are mostly whitespace or comments
          if (this.isInsignificant(normalized)) {
            continue;
          }

          const hash = this.hashCode(normalized);
          
          if (!codeBlocks.has(hash)) {
            codeBlocks.set(hash, []);
          }

          codeBlocks.get(hash)!.push({
            file: relativePath,
            line: i + 1,
            code: block.join('\n')
          });
        }
      },
      { skipTests: true }
    );
    
    return codeBlocks;
  }

  private generateViolations(codeBlocks: Map<string, CodeLocation[]>): Violation[] {
    const violations: Violation[] = [];

    for (const [_hash, locations] of codeBlocks.entries()) {
      if (locations.length < 2) continue;

      const uniqueFiles = this.getUniqueFiles(locations);
      if (uniqueFiles.size < 2) continue;

      const violation = this.createDuplicateViolation(uniqueFiles);
      violations.push(violation);
    }

    return violations;
  }

  private getUniqueFiles(locations: CodeLocation[]): Map<string, { line: number; code: string }> {
    const uniqueFiles = new Map<string, { line: number; code: string }>();
    
    for (const loc of locations) {
      if (!uniqueFiles.has(loc.file)) {
        uniqueFiles.set(loc.file, { line: loc.line, code: loc.code });
      }
    }
    
    return uniqueFiles;
  }

  private createDuplicateViolation(
    uniqueFiles: Map<string, { line: number; code: string }>
  ): Violation {
    const files = Array.from(uniqueFiles.keys());
    const filesList = files.slice(0, 3).join(', ') + 
      (files.length > 3 ? `, ... (${files.length} files)` : '');
    
    const { severity, penalty } = this.calculateSeverityAndPenalty(uniqueFiles.size);
    const firstFile = files[0];
    const firstOcc = uniqueFiles.get(firstFile)!;

    return createViolation({
      rule: 'Duplicate Code',
      severity,
      message: `Code duplicated in ${uniqueFiles.size} files: ${filesList}`,
      file: firstFile,
      line: firstOcc.line,
      impact: 'Increases maintenance burden and risk of inconsistencies',
      suggestedFix: 'Extract common logic into a shared function, class, or component',
      penalty
    });
  }

  private calculateSeverityAndPenalty(fileCount: number): {
    severity: 'info' | 'warning' | 'critical';
    penalty: number;
  } {
    if (fileCount >= CRITICAL_FILE_COUNT_THRESHOLD) {
      return { severity: 'critical', penalty: CRITICAL_PENALTY };
    }
    
    if (fileCount >= WARNING_FILE_COUNT_THRESHOLD) {
      return { severity: 'warning', penalty: WARNING_PENALTY };
    }
    
    return { severity: 'info', penalty: INFO_PENALTY };
  }

  private normalizeCode(lines: string[]): string {
    return lines
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('');
  }

  private isInsignificant(normalized: string): boolean {
    // Skip empty or very short blocks
    if (normalized.length < 10) return true;
    
    // Skip imports
    if (normalized.startsWith('import') || normalized.startsWith('export')) return true;
    
    // Skip comments
    if (normalized.startsWith('//') || normalized.startsWith('/*')) return true;
    
    // Skip simple closing blocks like "}}}"
    if (/^[}\])]+$/.test(normalized)) return true;

    return false;
  }

  /**
   * Generate hash using DJB2 algorithm for better collision resistance
   * @param s String to hash
   * @returns Hexadecimal hash string
   */
  private hashCode(s: string): string {
    let hash = 5381; // DJB2 initial value
    
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i);
      hash = ((hash << 5) + hash) + char; // hash * 33 + char
      hash = hash >>> 0; // Convert to unsigned 32-bit integer
    }
    
    return hash.toString(16);
  }
}
