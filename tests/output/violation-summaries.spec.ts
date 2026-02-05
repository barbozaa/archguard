import { describe, it, expect } from 'vitest';
import * as ViolationSummaries from '../../src/output/violation-summaries.js';

describe('Violation Summaries', () => {
  it('should export all structure violation summaries', () => {
    expect(ViolationSummaries.printGodFileSummary).toBeDefined();
    expect(ViolationSummaries.printCircularDepSummary).toBeDefined();
    expect(ViolationSummaries.printLayerViolationSummary).toBeDefined();
    expect(ViolationSummaries.printForbiddenImportSummary).toBeDefined();
  });

  it('should export all quality violation summaries', () => {
    expect(ViolationSummaries.printMissingTestsSummary).toBeDefined();
    expect(ViolationSummaries.printSkippedTestsSummary).toBeDefined();
    expect(ViolationSummaries.printMissingTypeAnnotationsSummary).toBeDefined();
    expect(ViolationSummaries.printUnusedExportsSummary).toBeDefined();
    expect(ViolationSummaries.printDeadCodeSummary).toBeDefined();
  });

  it('should export all complexity violation summaries', () => {
    expect(ViolationSummaries.printCyclomaticComplexitySummary).toBeDefined();
    expect(ViolationSummaries.printDeepNestingSummary).toBeDefined();
    expect(ViolationSummaries.printLargeFunctionSummary).toBeDefined();
    expect(ViolationSummaries.printLongParameterListSummary).toBeDefined();
    expect(ViolationSummaries.printTooManyImportsSummary).toBeDefined();
  });

  it('should export all code smell violation summaries', () => {
    expect(ViolationSummaries.printFeatureEnvySummary).toBeDefined();
    expect(ViolationSummaries.printDataClumpsSummary).toBeDefined();
    expect(ViolationSummaries.printShotgunSurgerySummary).toBeDefined();
    expect(ViolationSummaries.printDuplicateCodeSummary).toBeDefined();
  });

  it('should export all style violation summaries', () => {
    expect(ViolationSummaries.printMagicNumbersSummary).toBeDefined();
    expect(ViolationSummaries.printWildcardImportsSummary).toBeDefined();
    expect(ViolationSummaries.printTodoCommentsSummary).toBeDefined();
    expect(ViolationSummaries.printGenericViolationSummary).toBeDefined();
  });

  it('should export function types', () => {
    expect(typeof ViolationSummaries.printGodFileSummary).toBe('function');
    expect(typeof ViolationSummaries.printMissingTestsSummary).toBe('function');
    expect(typeof ViolationSummaries.printCyclomaticComplexitySummary).toBe('function');
    expect(typeof ViolationSummaries.printFeatureEnvySummary).toBe('function');
    expect(typeof ViolationSummaries.printMagicNumbersSummary).toBe('function');
  });
});
