import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as structureViolations from '@output/summaries/structure-violations.js';
import type { Violation } from '@core/types.js';

describe('Structure Violations Summaries', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should print god file summary', () => {
    const violations: Violation[] = [
      {
        message: 'File has 800 lines',
        file: 'large.ts',
        line: 1,
        severity: 'critical',
        rule: 'max-file-lines',
        impact: 'Hard to maintain',
        suggestedFix: 'Split file',
        penalty: 20
      }
    ];
    
    expect(() => structureViolations.printGodFileSummary(violations)).not.toThrow();
  });

  it('should print circular dependency summary', () => {
    const violations: Violation[] = [
      {
        message: 'Circular import detected',
        file: 'a.ts',
        line: 1,
        severity: 'critical',
        rule: 'circular-deps',
        impact: 'Build issues',
        suggestedFix: 'Break cycle',
        penalty: 25
      }
    ];
    
    expect(() => structureViolations.printCircularDepSummary(violations)).not.toThrow();
  });

  it('should print layer violation summary', () => {
    const violations: Violation[] = [
      {
        message: 'UI imports from data layer',
        file: 'ui.ts',
        line: 5,
        severity: 'critical',
        rule: 'layer-violation',
        impact: 'Architecture violation',
        suggestedFix: 'Use proper layers',
        penalty: 30
      }
    ];
    
    expect(() => structureViolations.printLayerViolationSummary(violations)).not.toThrow();
  });

  it('should print forbidden import summary', () => {
    const violations: Violation[] = [
      {
        message: 'Forbidden package imported',
        file: 'test.ts',
        line: 1,
        severity: 'critical',
        rule: 'forbidden-imports',
        impact: 'Policy violation',
        suggestedFix: 'Remove import',
        penalty: 20
      }
    ];
    
    expect(() => structureViolations.printForbiddenImportSummary(violations)).not.toThrow();
  });

  it('should handle empty violations', () => {
    expect(() => structureViolations.printGodFileSummary([])).not.toThrow();
    expect(() => structureViolations.printCircularDepSummary([])).not.toThrow();
    expect(() => structureViolations.printLayerViolationSummary([])).not.toThrow();
    expect(() => structureViolations.printForbiddenImportSummary([])).not.toThrow();
  });
});
