import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  printImpact,
  printSuggestedFix,
  printNumberedList,
  printSummaryStats,
  extractTotalFromMessages
} from '../../../src/output/summaries/summary-helpers.js';
import { Violation } from '../../../src/core/types.js';

describe('Summary Helpers', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('printImpact', () => {
    it('should print impact message with formatting', () => {
      printImpact('This is the impact');
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenNthCalledWith(1, expect.stringContaining('Impact:'));
      expect(consoleLogSpy).toHaveBeenNthCalledWith(2);
    });
  });

  describe('printSuggestedFix', () => {
    it('should print suggested fixes with formatting', () => {
      const suggestions = ['Fix option 1', 'Fix option 2'];
      printSuggestedFix(suggestions);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Suggested Fix:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Fix option 1'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Fix option 2'));
    });

    it('should handle empty suggestions array', () => {
      printSuggestedFix([]);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Suggested Fix:'));
    });
  });

  describe('printNumberedList', () => {
    it('should print numbered list with primary text only', () => {
      const items = [
        { primary: 'First item' },
        { primary: 'Second item' }
      ];
      
      printNumberedList('Items', items);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Items:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('First item'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Second item'));
    });

    it('should print numbered list with secondary text', () => {
      const items = [
        { primary: 'Item 1', secondary: 'Details 1' },
        { primary: 'Item 2', secondary: 'Details 2' }
      ];
      
      printNumberedList('Items', items);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Item 1'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Details 1'));
    });

    it('should support different colors', () => {
      const items = [{ primary: 'Test' }];
      
      printNumberedList('Yellow', items, 'yellow');
      printNumberedList('Cyan', items, 'cyan');
      printNumberedList('Green', items, 'green');
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('printSummaryStats', () => {
    it('should print stat with label and value', () => {
      printSummaryStats('Total Files', 42);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Total Files:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('42'));
    });

    it('should print stat with optional details', () => {
      printSummaryStats('Count', 10, '(filtered)');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Count:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('10'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('(filtered)'));
    });

    it('should handle string values', () => {
      printSummaryStats('Status', 'healthy');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Status:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('healthy'));
    });
  });

  describe('extractTotalFromMessages', () => {
    it('should extract and sum numbers from violation messages', () => {
      const violations: Violation[] = [
        {
          rule: 'test',
          severity: 'info',
          message: 'Found 5 issues',
          file: 'test.ts',
          line: 1,
          impact: 'test',
          suggestedFix: 'test',
          penalty: 1
        },
        {
          rule: 'test',
          severity: 'info',
          message: 'Found 3 issues',
          file: 'test.ts',
          line: 1,
          impact: 'test',
          suggestedFix: 'test',
          penalty: 1
        }
      ];

      const total = extractTotalFromMessages(violations, /Found (\d+) issues/);
      expect(total).toBe(8);
    });

    it('should return 0 for non-matching patterns', () => {
      const violations: Violation[] = [
        {
          rule: 'test',
          severity: 'info',
          message: 'No numbers here',
          file: 'test.ts',
          line: 1,
          impact: 'test',
          suggestedFix: 'test',
          penalty: 1
        }
      ];

      const total = extractTotalFromMessages(violations, /Found (\d+) issues/);
      expect(total).toBe(0);
    });

    it('should handle empty violations array', () => {
      const total = extractTotalFromMessages([], /(\d+)/);
      expect(total).toBe(0);
    });
  });
});
