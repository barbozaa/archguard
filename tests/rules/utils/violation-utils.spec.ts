import { describe, it, expect } from 'vitest';
import {
  calculateSeverityByCount,
  calculatePenaltyByThreshold,
  createViolation
} from '@rules/utils/violation-utils.js';

describe('Violation Utils', () => {
  describe('calculateSeverityByCount', () => {
    it('should return critical for counts above critical threshold', () => {
      const severity = calculateSeverityByCount(30, { critical: 25, warning: 15 });
      expect(severity).toBe('critical');
    });

    it('should return warning for counts between warning and critical', () => {
      const severity = calculateSeverityByCount(20, { critical: 25, warning: 15 });
      expect(severity).toBe('warning');
    });

    it('should return info for counts below warning threshold', () => {
      const severity = calculateSeverityByCount(10, { critical: 25, warning: 15 });
      expect(severity).toBe('info');
    });

    it('should handle edge case at critical threshold', () => {
      const severity = calculateSeverityByCount(25, { critical: 25, warning: 15 });
      expect(severity).toBe('critical');
    });

    it('should handle edge case at warning threshold', () => {
      const severity = calculateSeverityByCount(15, { critical: 25, warning: 15 });
      expect(severity).toBe('warning');
    });
  });

  describe('calculatePenaltyByThreshold', () => {
    it('should return 0 for counts at or below threshold', () => {
      expect(calculatePenaltyByThreshold(10, 10, 5)).toBe(0);
      expect(calculatePenaltyByThreshold(5, 10, 5)).toBe(0);
    });

    it('should calculate penalty based on excess', () => {
      const penalty = calculatePenaltyByThreshold(15, 10, 5);
      expect(penalty).toBe(5); // 15-10 = 5, ceil(5/10) = 1, 5*1 = 5
    });

    it('should scale penalty for large excesses', () => {
      const penalty = calculatePenaltyByThreshold(30, 10, 5);
      expect(penalty).toBe(10); // 30-10 = 20, ceil(20/10) = 2, 5*2 = 10
    });

    it('should handle fractional multipliers', () => {
      const penalty = calculatePenaltyByThreshold(25, 10, 3);
      expect(penalty).toBe(6); // 25-10 = 15, ceil(15/10) = 2, 3*2 = 6
    });
  });



  describe('createViolation', () => {
    it('should create a basic violation with default line 1', () => {
      const violation = createViolation({
        rule: 'Test Rule',
        severity: 'warning',
        message: 'Test message',
        file: 'test.ts',
        impact: 'Test impact',
        suggestedFix: 'Test fix',
        penalty: 5
      });

      expect(violation).toEqual({
        rule: 'Test Rule',
        severity: 'warning',
        message: 'Test message',
        file: 'test.ts',
        line: 1,
        impact: 'Test impact',
        suggestedFix: 'Test fix',
        penalty: 5
      });
    });

    it('should create a line-specific violation', () => {
      const violation = createViolation({
        rule: 'Test Rule',
        severity: 'critical',
        message: 'Test message',
        file: 'test.ts',
        line: 42,
        impact: 'Test impact',
        suggestedFix: 'Test fix',
        penalty: 10
      });

      expect(violation).toEqual({
        rule: 'Test Rule',
        severity: 'critical',
        message: 'Test message',
        file: 'test.ts',
        line: 42,
        impact: 'Test impact',
        suggestedFix: 'Test fix',
        penalty: 10
      });
    });

    it('should create a violation with related file', () => {
      const violation = createViolation({
        rule: 'Circular Dependency',
        severity: 'critical',
        message: 'Circular import detected',
        file: 'a.ts',
        relatedFile: 'b.ts',
        line: 5,
        impact: 'Creates tight coupling',
        suggestedFix: 'Break the cycle',
        penalty: 15
      });

      expect(violation).toEqual({
        rule: 'Circular Dependency',
        severity: 'critical',
        message: 'Circular import detected',
        file: 'a.ts',
        relatedFile: 'b.ts',
        line: 5,
        impact: 'Creates tight coupling',
        suggestedFix: 'Break the cycle',
        penalty: 15
      });
    });

    it('should default line to 1 when not provided', () => {
      const violation = createViolation({
        rule: 'Test Rule',
        severity: 'info',
        message: 'Test',
        file: 'a.ts',
        relatedFile: 'b.ts',
        impact: 'Test',
        suggestedFix: 'Test',
        penalty: 1
      });

      expect(violation.line).toBe(1);
    });
  });
});
