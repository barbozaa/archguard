import { describe, it, expect } from 'vitest';
import { ScoreCalculator } from '../../src/output/score-calculator.js';
import { Violation } from '../../src/core/types.js';

describe('ScoreCalculator', () => {
  it('should start at 100 with no violations', () => {
    const calculator = new ScoreCalculator();
    const result = calculator.calculate([], 10);
    
    expect(result.score).toBe(100);
    expect(result.status).toBe('Excellent');
  });

  it('should penalize violations correctly', () => {
    const calculator = new ScoreCalculator();
    const violations: Violation[] = [
      {
        rule: 'test',
        severity: 'critical',
        message: 'test',
        file: 'test.ts',
        impact: 'test',
        suggestedFix: 'test',
        penalty: 5,
      },
    ];
    
    const result = calculator.calculate(violations, 10);
    expect(result.score).toBeLessThan(100);
  });

  it('should return Critical status for low scores', () => {
    const calculator = new ScoreCalculator();
    // With more modules (50), scaling is minimal
    // 20 violations * 10 penalty = 200
    // Scaling factor = 1, adjusted = 200
    // Score = 100 - 200 = 0 (clamped), status = Critical
    const violations: Violation[] = Array(20).fill({
      rule: 'test',
      severity: 'critical',
      message: 'test',
      file: 'test.ts',
      impact: 'test',
      suggestedFix: 'test',
      penalty: 10,
    });
    
    const result = calculator.calculate(violations, 50);
    expect(result.status).toBe('Critical');
  });
});
