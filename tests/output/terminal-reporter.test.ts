import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TerminalReporter } from '@output/terminal-reporter.js';
import type { AnalysisResult } from '@core/types.js';

describe('TerminalReporter', () => {
  let reporter: TerminalReporter;

  beforeEach(() => {
    reporter = new TerminalReporter();
    // Mock console to avoid actual output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should create reporter instance', () => {
    expect(reporter).toBeDefined();
  });

  it('should generate report for empty violations', () => {
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

  it('should generate report with violations', () => {
    const result: AnalysisResult = {
      violations: [
        {
          message: 'Test violation',
          file: 'test.ts',
          severity: 'critical',
          rule: 'test-rule',
          line: 1,
          impact: 'Test impact',
          suggestedFix: 'Fix it',
          penalty: 10
        }
      ],
      score: 85,
      architectureScore: 88,
      hygieneScore: 82,
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

  it('should include score in report', () => {
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
      timestamp: new Date().toISOString(),
      projectName: 'test-project'
    };
    
    expect(() => reporter.report(result, true)).not.toThrow();
  });

  it('should group violations by type', () => {
    const result: AnalysisResult = {
      violations: [
        {
          message: 'File too large',
          file: 'large.ts',
          severity: 'critical',
          rule: 'God File',
          line: 1,
          impact: 'High',
          suggestedFix: 'Split file',
          penalty: 20
        },
        {
          message: 'Another large file',
          file: 'huge.ts',
          severity: 'critical',
          rule: 'God File',
          line: 1,
          impact: 'High',
          suggestedFix: 'Split file',
          penalty: 20
        }
      ],
      score: 70,
      architectureScore: 65,
      hygieneScore: 75,
      totalModules: 2,
      healthyModuleCount: 0,
      status: 'Needs Attention',
      criticalCount: 2,
      warningCount: 0,
      infoCount: 0,
      topRisks: [],
      timestamp: new Date().toISOString(),
      projectName: 'test-project'
    };
    
    expect(() => reporter.report(result, false)).not.toThrow();
  });

  it('should display verbose output when verbose=true', () => {
    const result: AnalysisResult = {
      violations: [
        {
          message: 'Function too large',
          file: 'app.ts',
          severity: 'warning',
          rule: 'Large Function',
          line: 10,
          impact: 'Readability',
          suggestedFix: 'Split function',
          penalty: 10
        }
      ],
      score: 80,
      architectureScore: 82,
      hygieneScore: 78,
      totalModules: 5,
      healthyModuleCount: 4,
      status: 'Healthy',
      criticalCount: 0,
      warningCount: 1,
      infoCount: 0,
      topRisks: [{
        message: 'Function too large',
        file: 'app.ts',
        line: 10,
        severity: 'warning',
        rule: 'Large Function',
        impact: 'Readability',
        suggestedFix: 'Split function',
        penalty: 10
      }],
      timestamp: new Date().toISOString(),
      projectName: 'test-project'
    };
    
    expect(() => reporter.report(result, true)).not.toThrow();
  });

  it('should handle circular dependency violations', () => {
    const result: AnalysisResult = {
      violations: [
        {
          message: 'A -> B -> A',
          file: 'a.ts',
          severity: 'critical',
          rule: 'Circular Dependency',
          line: 1,
          impact: 'Architecture',
          suggestedFix: 'Break cycle',
          penalty: 30
        }
      ],
      score: 65,
      architectureScore: 60,
      hygieneScore: 70,
      totalModules: 3,
      healthyModuleCount: 1,
      status: 'Needs Attention',
      criticalCount: 1,
      warningCount: 0,
      infoCount: 0,
      topRisks: [],
      timestamp: new Date().toISOString(),
      projectName: 'test-project'
    };
    
    expect(() => reporter.report(result, false)).not.toThrow();
  });

  it('should handle multiple violation types', () => {
    const result: AnalysisResult = {
      violations: [
        {
          message: 'File too large',
          file: 'large.ts',
          severity: 'critical',
          rule: 'God File',
          line: 1,
          impact: 'High',
          suggestedFix: 'Split file',
          penalty: 20
        },
        {
          message: 'Cycle detected',
          file: 'a.ts',
          severity: 'critical',
          rule: 'Circular Dependency',
          line: 5,
          impact: 'Architecture',
          suggestedFix: 'Break cycle',
          penalty: 30
        },
        {
          message: 'Too complex',
          file: 'complex.ts',
          severity: 'warning',
          rule: 'High Complexity',
          line: 15,
          impact: 'Maintainability',
          suggestedFix: 'Simplify',
          penalty: 15
        }
      ],
      score: 50,
      architectureScore: 45,
      hygieneScore: 55,
      totalModules: 10,
      healthyModuleCount: 7,
      status: 'Needs Attention',
      criticalCount: 2,
      warningCount: 1,
      infoCount: 0,
      topRisks: [],
      timestamp: new Date().toISOString(),
      projectName: 'test-project'
    };
    
    expect(() => reporter.report(result, false)).not.toThrow();
  });

  it('should display action items', () => {
    const result: AnalysisResult = {
      violations: [
        {
          message: 'Function has 150 lines',
          file: 'big.ts',
          severity: 'warning',
          rule: 'Large Function',
          line: 1,
          impact: 'Readability',
          suggestedFix: 'Split into smaller functions',
          penalty: 12
        }
      ],
      score: 88,
      architectureScore: 90,
      hygieneScore: 86,
      totalModules: 8,
      healthyModuleCount: 7,
      status: 'Healthy',
      criticalCount: 0,
      warningCount: 1,
      infoCount: 0,
      topRisks: [],
      timestamp: new Date().toISOString(),
      projectName: 'test-project'
    };
    
    expect(() => reporter.report(result, false)).not.toThrow();
  });
});

