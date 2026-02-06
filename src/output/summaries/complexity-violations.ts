import pc from 'picocolors';
import { Violation } from '@core/types.js';

export function printCyclomaticComplexitySummary(violations: Violation[]): void {
  const sortedByComplexity = violations
    .map(v => ({
      file: v.file,
      functionName: v.message.match(/(?:Function|Method|Arrow function) '([^']+)'/)?.[1] || 'unknown',
      complexity: parseInt(v.message.match(/complexity of (\d+)/)?.[1] || '0')
    }))
    .sort((a, b) => b.complexity - a.complexity);

  console.log(pc.dim('  Impact: ') + 'High complexity increases bug probability and makes code harder to test');
  console.log();
  console.log(pc.dim('  Most complex functions:'));
  
  sortedByComplexity.forEach((item, idx) => {
    const fileName = item.file.split('/').pop() || item.file;
    console.log(`    ${pc.red((idx + 1) + '.')} ${item.functionName} ${pc.dim(`in ${fileName} — complexity ${item.complexity}`)}`);
  });

  console.log();
  console.log(pc.bold('  💡 Suggested Fix:'));
  console.log('     Break down into smaller functions. Extract conditionals.');
  console.log('     Use early returns, strategy pattern, or lookup tables.');
}

export function printDeepNestingSummary(violations: Violation[]): void {
  const sortedByDepth = violations
    .map(v => ({
      file: v.file,
      functionName: v.message.match(/(?:Function|Method|Arrow function) '([^']+)'/)?.[1] || 'unknown',
      depth: parseInt(v.message.match(/depth of (\d+) levels/)?.[1] || '0')
    }))
    .sort((a, b) => b.depth - a.depth);

  console.log(pc.dim('  Impact: ') + 'Increases cyclomatic complexity, reduces readability and testability');
  console.log();
  console.log(pc.dim('  Most deeply nested functions:'));
  
  sortedByDepth.forEach((item, idx) => {
    const fileName = item.file.split('/').pop() || item.file;
    console.log(`    ${pc.yellow((idx + 1) + '.')} ${item.functionName} ${pc.dim(`in ${fileName} — ${item.depth} levels deep`)}`);
  });

  console.log();
  console.log(pc.bold('  💡 Suggested Fix:'));
  console.log('     Use early returns/guard clauses to reduce nesting.');
  console.log('     Extract nested blocks into separate helper methods.');
}

export function printLargeFunctionSummary(violations: Violation[]): void {
  const sortedBySize = violations
    .map(v => ({
      file: v.file,
      functionName: v.message.match(/(?:Function|Method|Arrow function) '([^']+)'/)?.[1] || 'unknown',
      lines: parseInt(v.message.match(/(\d+) lines/)?.[1] || '0')
    }))
    .sort((a, b) => b.lines - a.lines);

  console.log(pc.dim('  Impact: ') + 'Reduces testability, code comprehension, and maintainability');
  console.log();
  console.log(pc.dim('  Largest functions:'));
  
  sortedBySize.forEach((item, idx) => {
    const fileName = item.file.split('/').pop() || item.file;
    console.log(`    ${pc.yellow((idx + 1) + '.')} ${item.functionName} ${pc.dim(`in ${fileName} — ${item.lines} lines`)}`);
  });

  console.log();
  console.log(pc.bold('  💡 Suggested Fix:'));
  console.log('     Split large functions into smaller helper functions.');
  console.log('     Extract complex logic into well-named private methods.');
}

export function printLongParameterListSummary(violations: Violation[]): void {
  const sortedByCount = violations
    .map(v => ({
      file: v.file,
      functionName: v.message.match(/(?:Function|Method|Arrow function) '([^']+)'/)?.[1] || 'unknown',
      count: parseInt(v.message.match(/has (\d+) parameters/)?.[1] || '0')
    }))
    .sort((a, b) => b.count - a.count);

  console.log(pc.dim('  Impact: ') + 'Reduces readability, increases testing complexity');
  console.log();
  console.log(pc.dim('  Functions with most parameters:'));
  
  sortedByCount.forEach((item, idx) => {
    const fileName = item.file.split('/').pop() || item.file;
    console.log(`    ${pc.yellow((idx + 1) + '.')} ${item.functionName} ${pc.dim(`in ${fileName} — ${item.count} params`)}`);
  });

  console.log();
  console.log(pc.bold('  💡 Suggested Fix:'));
  console.log('     Use parameter objects to group related parameters.');
  console.log('     Apply builder pattern for complex construction.');
}

export function printTooManyImportsSummary(violations: Violation[]): void {
  const sortedByCount = violations
    .map(v => ({
      file: v.file,
      count: parseInt(v.message.match(/(\d+) imports/)?.[1] || '0')
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
