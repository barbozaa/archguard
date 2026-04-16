import { describe, it, expect } from 'vitest';
import * as ViolationSummaries from '@presentation/summaries/index.js';

describe('Violation Summaries barrel exports', () => {
  it('exports all structure violation summaries', () => {
    expect(typeof ViolationSummaries.printLayerViolationSummary).toBe('function');
  });

  it('exports all coupling violation summaries', () => {
    expect(typeof ViolationSummaries.printTooManyImportsSummary).toBe('function');
  });

  it('exports all design smell summaries', () => {
    expect(typeof ViolationSummaries.printDataClumpsSummary).toBe('function');
    expect(typeof ViolationSummaries.printShotgunSurgerySummary).toBe('function');
    expect(typeof ViolationSummaries.printDuplicateCodeSummary).toBe('function');
  });

  it('exports generic fallback summary', () => {
    expect(typeof ViolationSummaries.printGenericViolationSummary).toBe('function');
  });
});
