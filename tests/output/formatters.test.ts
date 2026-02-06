import { describe, it, expect } from 'vitest';
import {
  getSeverityIcon,
  getSeverityColor,
  getStatusIcon,
  getStatusColor,
  getScoreColor,
  getScoreBar,
  formatPriority,
  getRiskColor,
  wrapText
} from '@output/formatters.js';

describe('Formatters', () => {
  it('should get severity icon', () => {
    expect(getSeverityIcon('critical')).toBeDefined();
    expect(getSeverityIcon('warning')).toBeDefined();
    expect(getSeverityIcon('info')).toBeDefined();
  });

  it('should get severity color function', () => {
    const colorFn = getSeverityColor('critical');
    expect(typeof colorFn).toBe('function');
    expect(colorFn('test')).toBeDefined();
  });

  it('should get status icon', () => {
    expect(getStatusIcon('Excellent')).toBeDefined();
    expect(getStatusIcon('Good')).toBeDefined();
    expect(getStatusIcon('Needs Improvement')).toBeDefined();
    expect(getStatusIcon('Poor')).toBeDefined();
  });

  it('should get status color function', () => {
    const colorFn = getStatusColor('Excellent');
    expect(typeof colorFn).toBe('function');
  });

  it('should get score color function', () => {
    expect(typeof getScoreColor(95)).toBe('function');
    expect(typeof getScoreColor(75)).toBe('function');
    expect(typeof getScoreColor(50)).toBe('function');
    expect(typeof getScoreColor(30)).toBe('function');
  });

  it('should generate score bar', () => {
    const bar100 = getScoreBar(100);
    expect(bar100).toBeDefined();
    expect(typeof bar100).toBe('string');
    
    const bar50 = getScoreBar(50);
    expect(bar50).toBeDefined();
    
    const bar0 = getScoreBar(0);
    expect(bar0).toBeDefined();
  });

  it('should format priority', () => {
    expect(formatPriority('HIGH')).toBeDefined();
    expect(formatPriority('MEDIUM')).toBeDefined();
    expect(formatPriority('LOW')).toBeDefined();
  });

  it('should get risk color function', () => {
    const highRisk = getRiskColor('HIGH');
    expect(typeof highRisk).toBe('function');
    
    const mediumRisk = getRiskColor('MEDIUM');
    expect(typeof mediumRisk).toBe('function');
    
    const lowRisk = getRiskColor('LOW');
    expect(typeof lowRisk).toBe('function');
  });

  it('should wrap text', () => {
    const shortText = 'Short text';
    expect(wrapText(shortText, 100)).toBe(shortText);
    
    const longText = 'This is a very long text that should be wrapped at a certain width to make it more readable in terminal output';
    const wrapped = wrapText(longText, 50);
    expect(wrapped).toBeDefined();
    expect(typeof wrapped).toBe('string');
  });

  it('should handle edge cases', () => {
    expect(wrapText('', 50)).toBe('');
    expect(getScoreBar(0)).toBeDefined();
    expect(getScoreBar(100)).toBeDefined();
  });
});
