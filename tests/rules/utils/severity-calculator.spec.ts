import { describe, it, expect } from 'vitest';
import { calculateSeverity, calculatePenalty } from '@rules/utils/severity-calculator.js';
import type { SeverityThresholds, PenaltyConfig } from '@rules/utils/severity-calculator.js';

describe('severity-calculator', () => {
  describe('calculateSeverity', () => {
    const thresholds: SeverityThresholds = {
      critical: 20,
      warning: 10
    };

    it('should return "critical" when value exceeds critical threshold', () => {
      expect(calculateSeverity(25, thresholds)).toBe('critical');
      expect(calculateSeverity(21, thresholds)).toBe('critical');
    });

    it('should return "warning" when value is between warning and critical threshold', () => {
      expect(calculateSeverity(15, thresholds)).toBe('warning');
      expect(calculateSeverity(11, thresholds)).toBe('warning');
    });

    it('should return "info" when value is below warning threshold', () => {
      expect(calculateSeverity(5, thresholds)).toBe('info');
      expect(calculateSeverity(9, thresholds)).toBe('info');
    });

    it('should handle edge case at critical threshold', () => {
      expect(calculateSeverity(20, thresholds)).toBe('warning');
    });
  });

  describe('calculatePenalty', () => {
    const thresholds: SeverityThresholds = {
      critical: 20,
      warning: 10
    };

    const penaltyConfig: PenaltyConfig = {
      criticalBase: 15,
      criticalMultiplier: 2,
      warningBase: 10,
      warningMultiplier: 1.5,
      infoBase: 5
    };

    it('should calculate critical penalty correctly', () => {
      // value = 25, threshold = 8, excess = 17
      // value > critical (20), so: criticalBase + (excess * criticalMultiplier)
      const result = calculatePenalty(25, 8, thresholds, penaltyConfig);
      expect(result).toBe(15 + (17 * 2)); // 15 + 34 = 49
    });

    it('should calculate warning penalty correctly', () => {
      // value = 15, threshold = 8, excess = 7
      // value >= warning (10), so: warningBase + (excess * warningMultiplier)
      const result = calculatePenalty(15, 8, thresholds, penaltyConfig);
      expect(result).toBe(10 + (7 * 1.5)); // 10 + 10.5 = 20.5
    });

    it('should calculate info penalty correctly', () => {
      // value = 9, threshold = 5, excess = 4
      // value < warning (10), so: infoBase + excess
      const result = calculatePenalty(9, 5, thresholds, penaltyConfig);
      expect(result).toBe(5 + 4); // 9
    });

    it('should handle zero excess', () => {
      const result = calculatePenalty(5, 5, thresholds, penaltyConfig);
      expect(result).toBe(5); // infoBase + 0
    });

    it('should use infoMultiplier when provided', () => {
      const configWithInfoMultiplier: PenaltyConfig = {
        ...penaltyConfig,
        infoMultiplier: 0.5
      };
      
      // value = 7, threshold = 5, excess = 2
      const result = calculatePenalty(7, 5, thresholds, configWithInfoMultiplier);
      expect(result).toBe(5 + (2 * 0.5)); // 5 + 1 = 6
    });

    it('should not use infoMultiplier when not provided', () => {
      // value = 7, threshold = 5, excess = 2
      const result = calculatePenalty(7, 5, thresholds, penaltyConfig);
      expect(result).toBe(5 + 2); // 7
    });
  });
});
