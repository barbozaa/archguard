import pc from 'picocolors';
import { Violation } from '@core/types.js';
import { getFileName } from '@output/utils/violation-utils.js';
import { printImpact, printSuggestedFix, printNumberedList, printSummaryStats, extractTotalFromMessages } from './summary-helpers.js';

export function printMissingTestsSummary(violations: Violation[]): void {
  printImpact('Reduces confidence in code changes and increases regression risk');
  
  const items = violations.map(v => ({ primary: getFileName(v.file) }));
  printNumberedList('Untested files', items);

  printSuggestedFix([
    'Create corresponding .spec.ts files with unit tests.',
    'Target: at least 80% code coverage for critical logic.'
  ]);
}

export function printSkippedTestsSummary(violations: Violation[]): void {
  const byFile = violations.reduce((acc, v) => {
    const fileName = v.file.split('/').pop() || v.file;
    if (!acc[fileName]) acc[fileName] = [];
    acc[fileName].push(v);
    return acc;
  }, {} as Record<string, Violation[]>);

  printImpact('Reduces test coverage reliability, may hide broken functionality');
  
  const items = Object.keys(byFile).map(fileName => {
    const count = byFile[fileName].length;
    return {
      primary: fileName,
      secondary: `${count} skipped test${count === 1 ? '' : 's'}`
    };
  });
  printNumberedList('Skipped tests by file', items);

  printSuggestedFix([
    'Unskip and fix failing tests. Remove obsolete tests.',
    'Add issue tracker references for deferred work.'
  ]);
}

export function printMissingTypeAnnotationsSummary(violations: Violation[]): void {
  const totalMissing = extractTotalFromMessages(violations, /^(\d+) missing/);

  printImpact('Reduces type safety, IntelliSense quality, and code documentation');
  
  console.log(pc.dim('  Missing type annotations:'));
  printSummaryStats('Total', `${totalMissing} annotations across ${violations.length} ${violations.length === 1 ? 'file' : 'files'}`);
  
  console.log();
  const sortedByCount = violations
    .map(v => ({
      file: v.file,
      count: parseInt(v.message.match(/^(\d+) missing/)?.[1] || '0')
    }))
    .sort((a, b) => b.count - a.count);

  const items = sortedByCount.map(item => ({
    primary: getFileName(item.file),
    secondary: `${item.count} missing`
  }));
  printNumberedList('Files with most missing annotations', items, 'cyan');

  printSuggestedFix([
    'Add explicit type annotations to parameters and return types.',
    'Use TypeScript strict mode. Enable noImplicitAny in tsconfig.'
  ]);
}

export function printUnusedExportsSummary(violations: Violation[]): void {
  console.log(pc.dim('  Impact: ') + 'Dead code that increases maintenance burden and may confuse developers');
  console.log();
  console.log(pc.dim('  Unused exports:'));
  
  violations.forEach((v, idx) => {
    const fileName = getFileName(v.file);
    const exportName = v.message.match(/Export '([^']+)'/)?.[1] || 'unknown';
    console.log(`    ${pc.cyan((idx + 1) + '.')} ${exportName} ${pc.dim(`in ${fileName}`)}`);
  });

  console.log();
  console.log(pc.bold('  💡 Suggested Fix:'));
  console.log('     Remove unused exports or document if part of public API.');
  console.log('     Add to exclusion patterns if used externally.');
}
