import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as qualityViolations from '../../../src/output/summaries/quality-violations.js';
import type { Violation } from '../../src/core/types.js';

describe('Quality Violations Summaries', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should print missing tests summary', () => {
    const violations: Violation[] = [
      {
        message: 'No test file found',
        file: 'untested.ts',
        line: 1,
        severity: 'warning',
        rule: 'missing-tests',
        impact: 'Low test coverage',
        suggestedFix: 'Add tests',
        penalty: 10
      }
    ];
    
    expect(() => qualityViolations.printMissingTestsSummary(violations)).not.toThrow();
  });

  it('should print skipped tests summary', () => {
    const violations: Violation[] = [
      {
        message: 'Test is skipped',
        file: 'test.spec.ts',
        line: 10,
        severity: 'warning',
        rule: 'skipped-tests',
        impact: 'Reduced coverage',
        suggestedFix: 'Unskip or remove',
        penalty: 5
      }
    ];
    
    expect(() => qualityViolations.printSkippedTestsSummary(violations)).not.toThrow();
  });

  it('should print missing type annotations summary', () => {
    const violations: Violation[] = [
      {
        message: 'Parameter lacks type',
        file: 'untyped.ts',
        line: 5,
        severity: 'info',
        rule: 'missing-types',
        impact: 'Type safety',
        suggestedFix: 'Add types',
        penalty: 3
      }
    ];
    
    expect(() => qualityViolations.printMissingTypeAnnotationsSummary(violations)).not.toThrow();
  });

  it('should handle empty violations', () => {
    expect(() => qualityViolations.printMissingTestsSummary([])).not.toThrow();
    expect(() => qualityViolations.printSkippedTestsSummary([])).not.toThrow();
    expect(() => qualityViolations.printMissingTypeAnnotationsSummary([])).not.toThrow();
    expect(() => qualityViolations.printUnusedExportsSummary([])).not.toThrow();
    expect(() => qualityViolations.printDeadCodeSummary([])).not.toThrow();
  });

  it('should print unused exports summary', () => {
    const violations: Violation[] = [
      {
        message: 'Export never used',
        file: 'unused.ts',
        line: 3,
        severity: 'info',
        rule: 'unused-exports',
        impact: 'Clutter',
        suggestedFix: 'Remove export',
        penalty: 2
      }
    ];
    
    expect(() => qualityViolations.printUnusedExportsSummary(violations)).not.toThrow();
  });

  it('should print dead code summary with unreachable code', () => {
    const violations: Violation[] = [
      {
        message: "Unreachable code in 'myFunction'",
        file: 'src/dead.ts',
        line: 10,
        severity: 'warning',
        rule: 'dead-code',
        impact: 'Maintainability',
        suggestedFix: 'Remove unreachable code',
        penalty: 5
      }
    ];
    
    expect(() => qualityViolations.printDeadCodeSummary(violations)).not.toThrow();
  });

  it('should print dead code summary with unused variables', () => {
    const violations: Violation[] = [
      {
        message: "Variable 'unusedVar' is declared but never used",
        file: 'src/variables.ts',
        line: 5,
        severity: 'info',
        rule: 'dead-code',
        impact: 'Clutter',
        suggestedFix: 'Remove unused variable',
        penalty: 2
      }
    ];
    
    expect(() => qualityViolations.printDeadCodeSummary(violations)).not.toThrow();
  });

  it('should print dead code summary with mixed violations', () => {
    const violations: Violation[] = [
      {
        message: "Unreachable code in 'func1'",
        file: 'src/file1.ts',
        line: 10,
        severity: 'warning',
        rule: 'dead-code',
        impact: 'Maintainability',
        suggestedFix: 'Remove',
        penalty: 5
      },
      {
        message: "Variable 'temp' is declared but never used",
        file: 'src/file2.ts',
        line: 3,
        severity: 'info',
        rule: 'dead-code',
        impact: 'Clutter',
        suggestedFix: 'Remove',
        penalty: 2
      }
    ];
    
    expect(() => qualityViolations.printDeadCodeSummary(violations)).not.toThrow();
  });
});
