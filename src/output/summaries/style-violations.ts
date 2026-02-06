import pc from 'picocolors';
import { Violation } from '@core/types.js';
import { getFileName } from '@output/utils/violation-utils.js';
import { printImpact, printSuggestedFix, printNumberedList, printSummaryStats, extractTotalFromMessages, formatFileLocation } from './summary-helpers.js';

export function printMagicNumbersSummary(violations: Violation[]): void {
  const sortedByOccurrences = violations
    .map(v => ({
      file: v.file,
      number: v.message.match(/Number '([^']+)'/)?.[1] || 'unknown',
      count: parseInt(v.message.match(/appears (\d+) times/)?.[1] || '0')
    }))
    .sort((a, b) => b.count - a.count);

  printImpact('Reduces code clarity and maintainability, makes changes error-prone');
  
  const items = sortedByOccurrences.map(item => ({
    primary: `${item.number} ${pc.dim(`in ${getFileName(item.file)}`)}`,
    secondary: `${item.count} occurrences`
  }));
  printNumberedList('Most repeated magic numbers', items);

  printSuggestedFix([
    'Extract into named constants with descriptive names.',
    'Use enums for related constants. Move to config for thresholds.'
  ]);
}

export function printWildcardImportsSummary(violations: Violation[]): void {
  printImpact('Increases bundle size and reduces tree-shaking effectiveness');
  
  const items = violations.map(v => {
    const fileName = getFileName(v.file);
    const match = v.message.match(/import \* as (\w+) from '([^']+)'/);
    const alias = match?.[1] || 'unknown';
    const module = match?.[2] || 'unknown';
    return {
      primary: fileName,
      secondary: `import * as ${alias} from '${module}'`
    };
  });
  printNumberedList('Wildcard imports detected', items, 'cyan');

  printSuggestedFix([
    'Replace with named imports for only what you need.',
    'Enables better tree-shaking and makes dependencies explicit.'
  ]);
}

export function printTodoCommentsSummary(violations: Violation[]): void {
  const totalMarkers = extractTotalFromMessages(violations, /^(\d+) technical/);

  const MARKER_TYPES = ['TODO', 'FIXME', 'HACK', 'XXX'];
  const byType = violations.reduce((acc, v) => {
    const message = v.message;
    
    for (const type of MARKER_TYPES) {
      const pattern = new RegExp(`(\\d+) ${type}s?`);
      const match = message.match(pattern);
      if (match) {
        acc[type] = (acc[type] || 0) + parseInt(match[1]);
      }
    }
    
    return acc;
  }, {} as Record<string, number>);

  printImpact('Indicates incomplete work, known issues, or deferred improvements');
  
  console.log(pc.dim('  Technical debt markers:'));
  printSummaryStats('Total', `${totalMarkers} markers across ${violations.length} ${violations.length === 1 ? 'file' : 'files'}`);
  
  const breakdown = Object.entries(byType)
    .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
    .join(', ');
  if (breakdown) {
    console.log(`    ${pc.dim('Breakdown:')} ${breakdown}`);
  }

  console.log();
  console.log(pc.dim('  Files with most markers:'));
  
  const sortedByCount = violations
    .map(v => ({
      file: v.file,
      count: parseInt(v.message.match(/^(\d+) technical/)?.[1] || '0')
    }))
    .sort((a, b) => b.count - a.count);

  sortedByCount.forEach((item, idx) => {
    const fileName = getFileName(item.file);
    console.log(`    ${pc.yellow((idx + 1) + '.')} ${fileName} ${pc.dim(`— ${item.count} markers`)}`);
  });

  console.log();
  console.log(pc.bold('  💡 Suggested Fix:'));
  console.log('     Review markers: complete TODOs, fix FIXMEs, refactor HACKs.');
  console.log('     Create tracked issues for deferred work. Remove obsolete markers.');
}

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
