import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as codeSmellViolations from '@output/summaries/code-smell-violations.js';
import type { Violation } from '@core/types.js';

describe('Code Smell Violations Summaries', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should print feature envy summary', () => {
    const violations: Violation[] = [
      {
        message: 'Method uses other class extensively',
        file: 'test.ts',
        line: 15,
        severity: 'info',
        rule: 'feature-envy',
        impact: 'Poor encapsulation',
        suggestedFix: 'Move method',
        penalty: 8
      }
    ];
    
    expect(() => codeSmellViolations.printFeatureEnvySummary(violations)).not.toThrow();
  });

  it('should print data clumps summary', () => {
    const violations: Violation[] = [
      {
        message: 'Same parameters appear in multiple functions',
        file: 'test.ts',
        line: 5,
        severity: 'info',
        rule: 'data-clumps',
        impact: 'Code duplication',
        suggestedFix: 'Create class',
        penalty: 5
      }
    ];
    
    expect(() => codeSmellViolations.printDataClumpsSummary(violations)).not.toThrow();
  });

  it('should print shotgun surgery summary', () => {
    const violations: Violation[] = [
      {
        message: 'File has too many dependents',
        file: 'utils.ts',
        line: 1,
        severity: 'warning',
        rule: 'shotgun-surgery',
        impact: 'Ripple effects',
        suggestedFix: 'Reduce coupling',
        penalty: 15
      }
    ];
    
    expect(() => codeSmellViolations.printShotgunSurgerySummary(violations)).not.toThrow();
  });

  it('should print duplicate code summary', () => {
    const violations: Violation[] = [
      {
        message: 'Code duplicated in 3 places',
        file: 'test.ts',
        line: 10,
        severity: 'info',
        rule: 'duplicate-code',
        impact: 'Maintenance burden',
        suggestedFix: 'Extract common code',
        penalty: 5
      }
    ];
    
    expect(() => codeSmellViolations.printDuplicateCodeSummary(violations)).not.toThrow();
  });

  it('should handle empty violations', () => {
    expect(() => codeSmellViolations.printFeatureEnvySummary([])).not.toThrow();
    expect(() => codeSmellViolations.printDataClumpsSummary([])).not.toThrow();
    expect(() => codeSmellViolations.printShotgunSurgerySummary([])).not.toThrow();
    expect(() => codeSmellViolations.printDuplicateCodeSummary([])).not.toThrow();
  });
});
