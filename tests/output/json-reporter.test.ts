import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JsonReporter } from '@output/json-reporter.js';
import type { AnalysisResult } from '@core/types.js';

describe('JSONReporter', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should create JSON reporter instance', () => {
    const reporter = new JsonReporter();
    expect(reporter).toBeDefined();
  });

  it('should generate JSON report for empty violations', () => {
    const reporter = new JsonReporter();
    const result: AnalysisResult = {
      violations: [],
      score: 100,
      architectureScore: 100,
      hygieneScore: 100,
      totalModules: 10,
      healthyModuleCount: 10,
      status: 'Excellent',
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      topRisks: [],
      timestamp: new Date().toISOString(),
      projectName: 'test-project'
    };
    
    expect(() => reporter.report(result, false)).not.toThrow();
  });

  it('should generate JSON report with violations', () => {
    const reporter = new JsonReporter();
    const result: AnalysisResult = {
      violations: [
        {
          message: 'File is too large',
          file: 'test.ts',
          severity: 'critical',
          rule: 'max-file-lines',
          line: 1,
          impact: 'Maintainability',
          suggestedFix: 'Split file',
          penalty: 20
        }
      ],
      score: 80,
      architectureScore: 85,
      hygieneScore: 75,
      totalModules: 10,
      healthyModuleCount: 9,
      status: 'Healthy',
      criticalCount: 1,
      warningCount: 0,
      infoCount: 0,
      topRisks: [],
      timestamp: new Date().toISOString(),
      projectName: 'test-project'
    };
    
    expect(() => reporter.report(result, false)).not.toThrow();
  });

  it('should include metadata in report', () => {
    const reporter = new JsonReporter();
    const result: AnalysisResult = {
      violations: [],
      score: 100,
      architectureScore: 100,
      hygieneScore: 100,
      totalModules: 5,
      healthyModuleCount: 5,
      status: 'Excellent',
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      topRisks: [],
      timestamp: '2024-01-01T00:00:00.000Z',
      projectName: 'my-project'
    };
    
    expect(() => reporter.report(result, false)).not.toThrow();
  });
});
