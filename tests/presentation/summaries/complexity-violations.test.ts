import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as complexityViolations from '@presentation/summaries/complexity-violations.js';
import type { Violation } from '@domain/types.js';

const makeViolation = (overrides: Partial<Violation>): Violation => ({
  message: 'File has 25 imports (max: 15)',
  file: 'src/file.ts',
  line: 1,
  severity: 'warning',
  rule: 'too-many-imports',
  impact: 'Tight coupling',
  suggestedFix: 'Reduce imports',
  penalty: 10,
  ...overrides,
});

describe('printTooManyImportsSummary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('prints summary without throwing', () => {
    const violations: Violation[] = [
      makeViolation({ message: 'File has 20 imports (max: 15)', file: 'src/hub.ts' }),
      makeViolation({ message: 'File has 30 imports (max: 15)', file: 'src/god.ts' }),
    ];
    expect(() => complexityViolations.printTooManyImportsSummary(violations)).not.toThrow();
  });

  it('handles empty violations array', () => {
    expect(() => complexityViolations.printTooManyImportsSummary([])).not.toThrow();
  });
});
