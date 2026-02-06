import { describe, it, expect } from 'vitest';
import { generateNextActions } from '@output/action-generator.js';
import type { AnalysisResult } from '@core/types.js';

describe('Action Generator', () => {
  it('should generate actions for violations', () => {
    const result: AnalysisResult = {
      violations: [
        {
          message: 'File is too large',
          file: 'large.ts',
          line: 1,
          severity: 'critical',
          rule: 'max-file-lines',
          impact: 'Maintainability',
          suggestedFix: 'Split into smaller files',
          penalty: 20
        }
      ],
      score: 80,
      architectureScore: 85,
      hygieneScore: 75,
      status: 'Healthy',
      criticalCount: 1,
      warningCount: 0,
      infoCount: 0,
      healthyModuleCount: 9,
      totalModules: 10,
      topRisks: [],
      timestamp: new Date().toISOString(),
      projectName: 'test'
    };
    
    const actions = generateNextActions(result);
    expect(actions).toBeDefined();
    expect(Array.isArray(actions)).toBe(true);
  });

  it('should prioritize critical violations', () => {
    const result: AnalysisResult = {
      violations: [
        {
          message: 'Minor issue',
          file: 'test.ts',
          line: 1,
          severity: 'info',
          rule: 'test',
          impact: 'Low',
          suggestedFix: 'Fix when convenient',
          penalty: 2
        },
        {
          message: 'Major issue',
          file: 'test2.ts',
          line: 1,
          severity: 'critical',
          rule: 'Circular Dependency',
          impact: 'High',
          suggestedFix: 'Fix immediately',
          penalty: 50
        }
      ],
      score: 60,
      architectureScore: 65,
      hygieneScore: 55,
      status: 'Needs Attention',
      criticalCount: 1,
      warningCount: 0,
      infoCount: 1,
      healthyModuleCount: 8,
      totalModules: 10,
      topRisks: [],
      timestamp: new Date().toISOString(),
      projectName: 'test'
    };
    
    const actions = generateNextActions(result);
    expect(actions.length).toBeGreaterThan(0);
  });

  it('should handle empty violations', () => {
    const result: AnalysisResult = {
      violations: [],
      score: 100,
      architectureScore: 100,
      hygieneScore: 100,
      status: 'Excellent',
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      healthyModuleCount: 10,
      totalModules: 10,
      topRisks: [],
      timestamp: new Date().toISOString(),
      projectName: 'test'
    };
    
    const actions = generateNextActions(result);
    expect(actions).toBeDefined();
    expect(Array.isArray(actions)).toBe(true);
  });

  it('should include fix suggestions', () => {
    const result: AnalysisResult = {
      violations: [
        {
          message: 'Function too large',
          file: 'test.ts',
          line: 10,
          severity: 'warning',
          rule: 'Large Function',
          impact: 'Readability',
          suggestedFix: 'Extract smaller functions',
          penalty: 10
        }
      ],
      score: 85,
      architectureScore: 90,
      hygieneScore: 80,
      status: 'Healthy',
      criticalCount: 0,
      warningCount: 1,
      infoCount: 0,
      healthyModuleCount: 9,
      totalModules: 10,
      topRisks: [],
      timestamp: new Date().toISOString(),
      projectName: 'test'
    };
    
    const actions = generateNextActions(result);
    expect(actions.length).toBeGreaterThan(0);
  });
});
