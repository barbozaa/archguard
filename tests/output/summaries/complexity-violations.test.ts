import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as complexityViolations from '@output/summaries/complexity-violations.js';
import type { Violation } from '@core/types.js';

describe('Complexity Violations Summaries', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should print cyclomatic complexity summary', () => {
    const violations: Violation[] = [
      {
        message: 'Function complexity is 15',
        file: 'test.ts',
        line: 10,
        severity: 'warning',
        rule: 'cyclomatic-complexity',
        impact: 'Hard to test',
        suggestedFix: 'Simplify logic',
        penalty: 10
      }
    ];
    
    expect(() => complexityViolations.printCyclomaticComplexitySummary(violations)).not.toThrow();
  });

  it('should print large function summary', () => {
    const violations: Violation[] = [
      {
        message: 'Function has 120 lines',
        file: 'test.ts',
        line: 50,
        severity: 'warning',
        rule: 'large-function',
        impact: 'Hard to understand',
        suggestedFix: 'Split function',
        penalty: 12
      }
    ];
    
    expect(() => complexityViolations.printLargeFunctionSummary(violations)).not.toThrow();
  });

  it('should print deep nesting summary', () => {
    const violations: Violation[] = [
      {
        message: 'Nesting level is 6',
        file: 'test.ts',
        line: 30,
        severity: 'warning',
        rule: 'deep-nesting',
        impact: 'Cognitive load',
        suggestedFix: 'Extract methods',
        penalty: 8
      }
    ];
    
    expect(() => complexityViolations.printDeepNestingSummary(violations)).not.toThrow();
  });

  it('should print long parameter list summary', () => {
    const violations: Violation[] = [
      {
        message: 'Too many parameters',
        file: 'test.ts',
        line: 10,
        severity: 'info',
        rule: 'long-parameter-list',
        impact: 'Usability',
        suggestedFix: 'Use object parameter',
        penalty: 5
      }
    ];
    
    expect(() => complexityViolations.printLongParameterListSummary(violations)).not.toThrow();
  });

  it('should handle empty violations', () => {
    expect(() => complexityViolations.printCyclomaticComplexitySummary([])).not.toThrow();
    expect(() => complexityViolations.printLargeFunctionSummary([])).not.toThrow();
    expect(() => complexityViolations.printDeepNestingSummary([])).not.toThrow();
    expect(() => complexityViolations.printLongParameterListSummary([])).not.toThrow();
  });
});
