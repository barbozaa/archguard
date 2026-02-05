import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { ScoreCalculator } from '../../src/output/score-calculator.js';
import type { Violation } from '../../src/core/types.js';

describe('ScoreCalculator', () => {
  const calculator = new ScoreCalculator();

  it('should return 100 for no violations', () => {
    const violations: Violation[] = [];
    const result = calculator.calculate(violations, 1);
    expect(result.score).toBe(100);
  });

  it('should deduct penalty for violations', () => {
    const violations: Violation[] = [
      {
        rule: 'test-rule',
        severity: 'warning',
        message: 'test',
        file: 'test.ts',
        line: 1,
        impact: 'test',
        suggestedFix: 'test',
        penalty: 10
      }
    ];
    // With 1 module and 1 violation, scaling factor is high (~3)
    // Adjusted penalty: 10/3 ≈ 3, score: 100-3 = 97
    const result = calculator.calculate(violations, 1);
    expect(result.score).toBe(97);
  });

  it('should never go below 0', () => {
    const violations: Violation[] = Array(20).fill(null).map((_, i) => ({
      rule: `rule-${i}`,
      severity: 'critical' as const,
      message: 'test',
      file: 'test.ts',
      line: 1,
      impact: 'test',
      suggestedFix: 'test',
      penalty: 20
    }));
    // With 1 module and 20 violations, scaling is very high
    // Total penalty: 400, scaling ~41, adjusted: 400/41 ≈ 10
    const result = calculator.calculate(violations, 1);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThan(100);
  });

  it('should calculate correct score with multiple violations', () => {
    const violations: Violation[] = [
      {
        rule: 'rule-1',
        severity: 'warning',
        message: 'test',
        file: 'test.ts',
        line: 1,
        impact: 'test',
        suggestedFix: 'test',
        penalty: 5
      },
      {
        rule: 'rule-2',
        severity: 'critical',
        message: 'test',
        file: 'test.ts',
        line: 1,
        impact: 'test',
        suggestedFix: 'test',
        penalty: 15
      }
    ];
    // With 1 module and 2 violations (total penalty 20)
    // Scaling factor ~5, adjusted penalty: 20/5 = 4
    const result = calculator.calculate(violations, 1);
    expect(result.score).toBe(96);
  });

  it('should handle decimal penalties', () => {
    const violations: Violation[] = [
      {
        rule: 'rule-1',
        severity: 'info',
        message: 'test',
        file: 'test.ts',
        line: 1,
        impact: 'test',
        suggestedFix: 'test',
        penalty: 2.5
      }
    ];
    // With 1 module and 1 violation, scaling ~3
    // Adjusted: 2.5/3 ≈ 0.83, rounded = 1
    const result = calculator.calculate(violations, 1);
    expect(result.score).toBe(99);
  });
});
