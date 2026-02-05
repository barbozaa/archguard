import { describe, it, expect } from 'vitest';
import { Reporter } from '../../src/output/reporter-interface.js';
import { AnalysisResult, HealthStatus } from '../../src/core/types.js';

describe('Reporter Interface', () => {
  it('should be implementable by concrete reporters', () => {
    class TestReporter implements Reporter {
      public lastResult: AnalysisResult | null = null;
      public lastVerbose: boolean = false;

      report(result: AnalysisResult, verbose: boolean): void {
        this.lastResult = result;
        this.lastVerbose = verbose;
      }
    }

    const reporter = new TestReporter();
    
    const mockResult: AnalysisResult = {
      violations: [],
      score: 100,
      status: 'Healthy' as HealthStatus,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      totalModules: 10,
      healthyModuleCount: 10,
      topRisks: [],
      timestamp: '2026-02-04T00:00:00Z',
      projectName: 'test-project'
    };

    reporter.report(mockResult, true);

    expect(reporter.lastResult).toBe(mockResult);
    expect(reporter.lastVerbose).toBe(true);
  });

  it('should allow multiple reporter implementations', () => {
    class ConsoleReporter implements Reporter {
      report(_result: AnalysisResult, _verbose: boolean): void {
        // Implementation
      }
    }

    class JsonReporter implements Reporter {
      report(_result: AnalysisResult, _verbose: boolean): void {
        // Implementation
      }
    }

    const consoleReporter = new ConsoleReporter();
    const jsonReporter = new JsonReporter();

    expect(consoleReporter).toBeDefined();
    expect(jsonReporter).toBeDefined();
  });

  it('should require both result and verbose parameters', () => {
    class StrictReporter implements Reporter {
      report(result: AnalysisResult, verbose: boolean): void {
        expect(result).toBeDefined();
        expect(typeof verbose).toBe('boolean');
      }
    }

    const reporter = new StrictReporter();
    const mockResult: AnalysisResult = {
      violations: [],
      score: 85,
      status: 'Needs Attention' as HealthStatus,
      criticalCount: 0,
      warningCount: 1,
      infoCount: 0,
      totalModules: 5,
      healthyModuleCount: 4,
      topRisks: [],
      timestamp: '2026-02-04T00:00:00Z',
      projectName: 'test-project'
    };

    reporter.report(mockResult, false);
  });
});
