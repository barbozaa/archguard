import { Violation } from '@core/types.js';

/**
 * Groups violations by their rule type
 */
export function groupViolationsByType(violations: Violation[]): Record<string, Violation[]> {
  const grouped: Record<string, Violation[]> = {};
  for (const violation of violations) {
    if (!grouped[violation.rule]) {
      grouped[violation.rule] = [];
    }
    grouped[violation.rule].push(violation);
  }
  return grouped;
}

/**
 * Extracts the file name from a file path
 */
export function getFileName(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}
