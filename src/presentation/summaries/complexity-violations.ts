import pc from 'picocolors';
import { Violation } from '@domain/types.js';

export function printTooManyImportsSummary(violations: Violation[]): void {
  const sortedByCount = violations
    .map(v => ({
      file: v.file,
      count: parseInt(v.message.match(/(\d+) imports/)?.[1] || '0'),
    }))
    .sort((a, b) => b.count - a.count);

  console.log(pc.dim('  Impact: ') + 'Increases coupling, reduces modularity, violates Single Responsibility');
  console.log();
  console.log(pc.dim('  Files with excessive imports:'));

  sortedByCount.forEach((item, idx) => {
    const fileName = item.file.split('/').pop() || item.file;
    console.log(`    ${pc.yellow((idx + 1) + '.')} ${fileName} ${pc.dim(`— ${item.count} imports`)}`);
  });

  console.log();
  console.log(pc.bold('  💡 Suggested Fix:'));
  console.log('     Refactor into smaller, focused modules.');
  console.log('     Remove unused imports. Use facade pattern to reduce dependencies.');
}
