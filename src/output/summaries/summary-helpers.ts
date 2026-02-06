import pc from 'picocolors';
import { Violation } from '@core/types.js';

/**
 * Shared utilities for formatting violation summaries
 * Reduces code duplication across summary files
 */

/**
 * Format file location with line number for clickable terminal links
 */
export function formatFileLocation(violation: Violation): string {
  return violation.line ? `${violation.file}:${violation.line}` : violation.file;
}

/**
 * Print the impact section of a violation summary
 */
export function printImpact(impact: string): void {
  console.log(pc.dim('  Impact: ') + impact);
  console.log();
}

/**
 * Print the suggested fix section of a violation summary
 */
export function printSuggestedFix(suggestions: string[]): void {
  console.log();
  console.log(pc.bold('  💡 Suggested Fix:'));
  suggestions.forEach(suggestion => {
    console.log(`     ${suggestion}`);
  });
}

/**
 * Print a numbered list of items
 */
export function printNumberedList(
  title: string,
  items: Array<{ primary: string; secondary?: string }>,
  color: 'yellow' | 'cyan' | 'green' = 'yellow'
): void {
  console.log(pc.dim(`  ${title}:`));
  
  items.forEach((item, idx) => {
    const number = pc[color]((idx + 1) + '.');
    const line = item.secondary 
      ? `    ${number} ${item.primary} ${pc.dim(`— ${item.secondary}`)}`
      : `    ${number} ${item.primary}`;
    console.log(line);
  });
}

/**
 * Print a summary statistic
 */
export function printSummaryStats(label: string, value: string | number, details?: string): void {
  console.log(`    ${pc.yellow(label + ':')} ${value}${details ? ` ${pc.dim(details)}` : ''}`);
}

/**
 * Calculate total count from violations by extracting number from message pattern
 */
export function extractTotalFromMessages(violations: Violation[], pattern: RegExp): number {
  return violations.reduce((sum, v) => {
    const match = v.message.match(pattern);
    return sum + (match ? parseInt(match[1]) : 0);
  }, 0);
}
