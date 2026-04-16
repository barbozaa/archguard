import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as codeSmellViolations from '@presentation/summaries/code-smell-violations.js';
import type { Violation } from '@domain/types.js';

const makeViolation = (overrides: Partial<Violation>): Violation => ({
  message: 'violation',
  file: 'src/file.ts',
  line: 1,
  severity: 'info',
  rule: 'data-clumps',
  impact: 'Code smell',
  suggestedFix: 'Refactor',
  penalty: 5,
  ...overrides,
});

describe('Code Smell Violations Summaries', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('prints data clumps summary without throwing', () => {
    const violations: Violation[] = [
      makeViolation({ message: 'Found data clump with 3 parameters (start, end, ctx) appearing in 4 locations.' }),
    ];
    expect(() => codeSmellViolations.printDataClumpsSummary(violations)).not.toThrow();
  });

  it('prints shotgun surgery summary without throwing', () => {
    const violations: Violation[] = [
      makeViolation({ rule: 'shotgun-surgery', message: "Symbol 'MyUtils' from utils.ts is used in 8 files: a, b, c" }),
    ];
    expect(() => codeSmellViolations.printShotgunSurgerySummary(violations)).not.toThrow();
  });

  it('prints duplicate code summary without throwing', () => {
    const violations: Violation[] = [
      makeViolation({ rule: 'duplicate-code', message: 'Block of 25 lines duplicated in 3 files: a.ts, b.ts' }),
    ];
    expect(() => codeSmellViolations.printDuplicateCodeSummary(violations)).not.toThrow();
  });

  it('handles empty violations', () => {
    expect(() => codeSmellViolations.printDataClumpsSummary([])).not.toThrow();
    expect(() => codeSmellViolations.printShotgunSurgerySummary([])).not.toThrow();
    expect(() => codeSmellViolations.printDuplicateCodeSummary([])).not.toThrow();
  });
});
