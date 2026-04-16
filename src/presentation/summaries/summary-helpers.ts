import pc from 'picocolors';
import { Violation } from '@domain/types.js';

/**
 * Format file location with line number for clickable terminal links
 */
export function formatFileLocation(violation: Violation): string {
  return violation.line ? `${violation.file}:${violation.line}` : violation.file;
}

export function printImpact(impact: string): void {
  console.log(pc.dim('  Impact: ') + impact);
  console.log();
}

export function printSuggestedFix(suggestions: string[]): void {
  console.log();
  console.log(pc.bold('  💡 Suggested Fix:'));
  suggestions.forEach(suggestion => {
    console.log(`     ${suggestion}`);
  });
}

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

export function printSummaryStats(label: string, value: string | number, details?: string): void {
  console.log(`    ${pc.yellow(label + ':')} ${value}${details ? ` ${pc.dim(details)}` : ''}`);
}

export function extractTotalFromMessages(violations: Violation[], pattern: RegExp): number {
  return violations.reduce((sum, v) => {
    const match = v.message.match(pattern);
    return sum + (match ? parseInt(match[1]) : 0);
  }, 0);
}

/**
 * Fallback printer for violation types without a dedicated summary function
 */
export function printGenericViolationSummary(violations: Violation[]): void {
  console.log(pc.dim('  Impact: ') + violations[0].impact);
  console.log();
  console.log(pc.dim('  Violations:'));

  violations.forEach((v, idx) => {
    const fileLocation = formatFileLocation(v);
    const location = v.relatedFile ? `${fileLocation} → ${v.relatedFile}` : fileLocation;
    console.log(`    ${(idx + 1) + '.'} ${pc.dim(location)}`);
  });

  console.log();
  console.log(pc.bold('  💡 Suggested Fix:'));
  console.log('     ' + violations[0].suggestedFix.split('\n')[0]);
}
