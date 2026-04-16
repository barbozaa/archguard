import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as structureViolations from '@presentation/summaries/structure-violations.js';
import type { Violation } from '@domain/types.js';

const makeViolation = (overrides: Partial<Violation>): Violation => ({
  message: 'violation',
  file: 'src/file.ts',
  line: 1,
  severity: 'critical',
  rule: 'layer-violation',
  impact: 'Breaks architecture',
  suggestedFix: 'Fix it',
  penalty: 20,
  ...overrides,
});

describe('printLayerViolationSummary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('prints summary without throwing', () => {
    const violations: Violation[] = [
      makeViolation({ message: 'UI layer importing from data layer', file: 'ui/component.ts', relatedFile: 'data/repository.ts' }),
    ];
    expect(() => structureViolations.printLayerViolationSummary(violations)).not.toThrow();
  });

  it('handles violations without layer info in message', () => {
    const violations: Violation[] = [
      makeViolation({ message: 'Generic layer violation', file: 'src/ui.ts', relatedFile: 'src/data.ts' }),
    ];
    expect(() => structureViolations.printLayerViolationSummary(violations)).not.toThrow();
  });

  it('handles empty array', () => {
    expect(() => structureViolations.printLayerViolationSummary([])).not.toThrow();
  });
});
