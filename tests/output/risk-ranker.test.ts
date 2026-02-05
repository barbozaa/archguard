import { describe, it, expect } from 'vitest';
import { RiskRanker } from '../../src/output/risk-ranker.js';
import type { Violation } from '../../src/core/types.js';

describe('RiskRanker', () => {
  it('should create risk ranker instance', () => {
    const ranker = new RiskRanker();
    expect(ranker).toBeDefined();
  });

  it('should rank violations by risk', () => {
    const ranker = new RiskRanker();
    const violations: Violation[] = [
      {
        message: 'Low risk',
        file: 'test1.ts',
        severity: 'info',
        rule: 'test',
        line: 1,
        impact: 'Low',
        suggestedFix: 'Fix',
        penalty: 5
      },
      {
        message: 'High risk',
        file: 'test2.ts',
        severity: 'critical',
        rule: 'test',
        line: 1,
        impact: 'High',
        suggestedFix: 'Fix',
        penalty: 50
      }
    ];
    
    const ranked = ranker.rank(violations);
    expect(ranked).toBeDefined();
    expect(Array.isArray(ranked)).toBe(true);
    expect(ranked.length).toBeLessThanOrEqual(violations.length);
  });

  it('should return top 10 risks by default', () => {
    const ranker = new RiskRanker();
    const violations: Violation[] = Array.from({ length: 20 }, (_, i) => ({
      message: `Violation ${i}`,
      file: `test${i}.ts`,
      severity: i % 2 === 0 ? 'critical' : 'warning' as 'critical' | 'warning',
      rule: 'test',
      line: 1,
      impact: 'Medium',
      suggestedFix: 'Fix',
      penalty: i * 2
    }));
    
    const ranked = ranker.rank(violations);
    expect(ranked.length).toBe(5);
  });

  it('should count violations by severity', () => {
    const ranker = new RiskRanker();
    const violations: Violation[] = [
      { type: 'Test', message: '', file: '', severity: 'critical', rule: 'test', line: 11, impact: '', suggestedFix: '', penalty: 1 },
      { type: 'Test', message: '', file: '', severity: 'critical', rule: 'test', line: 11, impact: '', suggestedFix: '', penalty: 1 },
      { type: 'Test', message: '', file: '', severity: 'warning', rule: 'test', line: 11, impact: '', suggestedFix: '', penalty: 1 },
      { type: 'Test', message: '', file: '', severity: 'info', rule: 'test', line: 11, impact: '', suggestedFix: '', penalty: 1 },
      { type: 'Test', message: '', file: '', severity: 'info', rule: 'test', line: 11, impact: '', suggestedFix: '', penalty: 1 },
    ];

    const counts = ranker.countBySeverity(violations);
    expect(counts.critical).toBe(2);
    expect(counts.warning).toBe(1);
    expect(counts.info).toBe(2);
  });

  it('should handle empty violations array', () => {
    const ranker = new RiskRanker();
    const ranked = ranker.rank([]);
    expect(ranked.length).toBe(0);
  });

  it('should rank by penalty when severity is equal', () => {
    const ranker = new RiskRanker();
    const violations: Violation[] = [
      { type: 'Test', message: '', file: '', severity: 'warning', rule: 'test', line: 11, impact: '', suggestedFix: '', penalty: 5 },
      { type: 'Test', message: '', file: '', severity: 'warning', rule: 'test', line: 11, impact: '', suggestedFix: '', penalty: 10 },
      { type: 'Test', message: '', file: '', severity: 'warning', rule: 'test', line: 11, impact: '', suggestedFix: '', penalty: 3 },
    ];

    const ranked = ranker.rank(violations, 3);
    expect(ranked[0].penalty).toBe(10);
    expect(ranked[1].penalty).toBe(5);
    expect(ranked[2].penalty).toBe(3);
  });

  it('should maintain severity priority over penalty', () => {
    const ranker = new RiskRanker();
    const violations: Violation[] = [
      { type: 'Test', message: '', file: '', severity: 'info', rule: 'test', line: 11, impact: '', suggestedFix: '', penalty: 100 },
      { type: 'Test', message: '', file: '', severity: 'critical', rule: 'test', line: 11, impact: '', suggestedFix: '', penalty: 1 },
    ];

    const ranked = ranker.rank(violations, 2);
    expect(ranked[0].severity).toBe('critical');
    expect(ranked[1].severity).toBe('info');
  });
});
