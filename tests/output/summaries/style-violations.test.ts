import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as styleViolations from '../../../src/output/summaries/style-violations.js';
import type { Violation } from '../../../src/core/types.js';

describe('Style Violations Summaries', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should print magic numbers summary', () => {
    const violations: Violation[] = [
      {
        message: "Magic Number '42' found — appears 5 times",
        file: 'test.ts',
        line: 10,
        severity: 'info',
        rule: 'magic-numbers',
        impact: 'Readability',
        suggestedFix: 'Use named constant',
        penalty: 2
      }
    ];
    
    expect(() => styleViolations.printMagicNumbersSummary(violations)).not.toThrow();
  });

  it('should print wildcard imports summary', () => {
    const violations: Violation[] = [
      {
        message: "import * as utils from './utils'",
        file: 'test.ts',
        line: 1,
        severity: 'info',
        rule: 'wildcard-imports',
        impact: 'Tree shaking',
        suggestedFix: 'Import specific items',
        penalty: 3
      }
    ];
    
    expect(() => styleViolations.printWildcardImportsSummary(violations)).not.toThrow();
  });

  it('should print TODO comments summary', () => {
    const violations: Violation[] = [
      {
        message: '3 technical debt markers found (2 TODOs, 1 FIXME)',
        file: 'test.ts',
        line: 15,
        severity: 'info',
        rule: 'todo-comments',
        impact: 'Technical debt',
        suggestedFix: 'Address TODO',
        penalty: 2
      }
    ];
    
    expect(() => styleViolations.printTodoCommentsSummary(violations)).not.toThrow();
  });

  it('should print generic violation summary', () => {
    const violations: Violation[] = [
      {
        message: 'Some violation',
        file: 'test.ts',
        line: 15,
        severity: 'warning',
        rule: 'generic',
        impact: 'Code quality',
        suggestedFix: 'Fix the issue',
        penalty: 5
      }
    ];
    
    expect(() => styleViolations.printGenericViolationSummary(violations)).not.toThrow();
  });

  it('should handle empty violations for magic numbers', () => {
    expect(() => styleViolations.printMagicNumbersSummary([])).not.toThrow();
  });

  it('should handle empty violations for wildcard imports', () => {
    expect(() => styleViolations.printWildcardImportsSummary([])).not.toThrow();
  });

  it('should handle multiple violations', () => {
    const violations: Violation[] = [
      {
        message: "Magic Number '42' found — appears 3 times",
        file: 'test1.ts',
        line: 10,
        severity: 'info',
        rule: 'magic-numbers',
        impact: 'Readability',
        suggestedFix: 'Use constant',
        penalty: 2
      },
      {
        message: "Magic Number '100' found — appears 2 times",
        file: 'test2.ts',
        line: 20,
        severity: 'info',
        rule: 'magic-numbers',
        impact: 'Readability',
        suggestedFix: 'Use constant',
        penalty: 2
      }
    ];
    
    expect(() => styleViolations.printMagicNumbersSummary(violations)).not.toThrow();
  });
});
