import pc from 'picocolors';
import { Violation } from '@core/types.js';

export function printFeatureEnvySummary(violations: Violation[]): void {
  console.log(pc.dim('  Impact: ') + 'Violates encapsulation and creates tight coupling');
  console.log();
  console.log(pc.dim('  Methods envying other classes:'));
  
  violations.forEach((v, idx) => {
    const fileName = v.file.split('/').pop() || v.file;
    const methodMatch = v.message.match(/Method '([^']+)'/);
    const objectMatch = v.message.match(/uses '([^']+)'/);
    const method = methodMatch ? methodMatch[1] : 'unknown';
    const enviedObject = objectMatch ? objectMatch[1] : 'unknown';
    console.log(`    ${pc.yellow((idx + 1) + '.')} ${method} ${pc.dim(`envies ${enviedObject} — in ${fileName}`)}`);
  });

  console.log();
  console.log(pc.bold('  💡 Suggested Fix:'));
  console.log('     Move method to the envied class or extract shared logic.');
  console.log('     Use Tell, Don\'t Ask principle to improve encapsulation.');
}

export function printDataClumpsSummary(violations: Violation[]): void {
  console.log(pc.dim('  Impact: ') + 'Indicates missing abstraction, makes refactoring error-prone');
  console.log();
  console.log(pc.dim('  Parameter groups appearing together:'));
  
  violations.forEach((v, idx) => {
    const paramsMatch = v.message.match(/\[([^\]]+)\]/);
    const countMatch = v.message.match(/appears (\d+) times/);
    const params = paramsMatch ? paramsMatch[1] : 'unknown';
    const count = countMatch ? countMatch[1] : '?';
    console.log(`    ${pc.yellow((idx + 1) + '.')} [${params}] ${pc.dim(`— ${count} occurrences`)}`);
  });

  console.log();
  console.log(pc.bold('  💡 Suggested Fix:'));
  console.log('     Extract parameter groups into interfaces or classes.');
  console.log('     Create cohesive types that represent domain concepts.');
}

export function printShotgunSurgerySummary(violations: Violation[]): void {
  const sortedByFileCount = violations
    .map(v => ({
      file: v.file,
      symbol: v.message.match(/Symbol '([^']+)'/)?.[1] || 'unknown',
      fileCount: parseInt(v.message.match(/used in (\d+) files/)?.[1] || '0')
    }))
    .sort((a, b) => b.fileCount - a.fileCount);

  console.log(pc.dim('  Impact: ') + 'Changes require modifying many files, increasing risk');
  console.log();
  console.log(pc.dim('  Symbols with widest usage:'));
  
  sortedByFileCount.forEach((item, idx) => {
    const fileName = item.file.split('/').pop() || item.file;
    console.log(`    ${pc.red((idx + 1) + '.')} ${item.symbol} ${pc.dim(`from ${fileName} — ${item.fileCount} files`)}`);
  });

  console.log();
  console.log(pc.bold('  💡 Suggested Fix:'));
  console.log('     Introduce facade or wrapper to reduce direct coupling.');
  console.log('     Use dependency injection to centralize usage.');
}

export function printDuplicateCodeSummary(violations: Violation[]): void {
  // Group violations by the set of files involved in the duplication
  const groupedByFiles = new Map<string, Violation[]>();
  
  violations.forEach(v => {
    const files = v.message.match(/files: (.+)$/)?.[1] || 'unknown';
    if (!groupedByFiles.has(files)) {
      groupedByFiles.set(files, []);
    }
    groupedByFiles.get(files)!.push(v);
  });

  console.log(pc.dim('  Impact: ') + 'Increases maintenance burden and bug probability');
  console.log();
  console.log(pc.dim(`  ${groupedByFiles.size} unique duplicate patterns found:`));
  
  let idx = 1;
  for (const [files, dupes] of groupedByFiles.entries()) {
    const fileCount = dupes[0].message.match(/duplicated in (\d+) files/)?.[1] || '?';
    const blockCount = dupes.length;
    console.log(`    ${pc.yellow(idx + '.')} ${blockCount} block${blockCount > 1 ? 's' : ''} duplicated in ${fileCount} files ${pc.dim(`— ${files}`)}`);
    idx++;
  }

  console.log();
  console.log(pc.bold('  💡 Suggested Fix:'));
  console.log('     Extract into shared utility functions or classes.');
  console.log('     Use inheritance, composition, or Template Method pattern.');
}
