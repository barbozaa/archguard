import pc from 'picocolors';
import { Violation } from '@core/types.js';

export function printGodFileSummary(violations: Violation[]): void {
  const sortedBySize = violations
    .map(v => ({
      file: v.file,
      lines: parseInt(v.message.match(/(\d+) lines/)?.[1] || '0')
    }))
    .sort((a, b) => b.lines - a.lines);

  console.log(pc.dim('  Impact: ') + 'Reduces code maintainability and increases cognitive load');
  console.log();
  console.log(pc.dim('  Files:'));
  
  sortedBySize.forEach((item, idx) => {
    const fileName = item.file.split('/').pop() || item.file;
    console.log(`    ${pc.yellow((idx + 1) + '.')} ${fileName} ${pc.dim(`— ${item.lines} lines`)}`);
  });

  console.log();
  console.log(pc.bold('  💡 Suggested Fix:'));
  console.log('     Split large files into focused modules (classes, utilities, types).');
  console.log('     Target: Keep files under 500 lines for better maintainability.');
}

export function printCircularDepSummary(violations: Violation[]): void {
  console.log(pc.dim('  Impact: ') + pc.red('HIGH') + ' — Prevents proper modularization, causes initialization issues');
  console.log();
  console.log(pc.dim('  Detected cycles:'));
  
  violations.forEach((v, idx) => {
    const cycle = `${v.file} ↔ ${v.relatedFile}`;
    console.log(`    ${pc.red((idx + 1) + '.')} ${pc.dim(cycle)}`);
  });

  console.log();
  console.log(pc.bold('  💡 Suggested Fix:'));
  console.log('     • Extract shared code into a new module');
  console.log('     • Use dependency injection');
  console.log('     • Introduce abstraction/interface layer');
}

export function printLayerViolationSummary(violations: Violation[]): void {
  console.log(pc.dim('  Impact: ') + 'Breaks architectural boundaries and separation of concerns');
  console.log();
  console.log(pc.dim('  Architectural violations:'));
  
  violations.forEach((v, idx) => {
    const layerMatch = v.message.match(/(\w+) layer importing from (\w+) layer/);
    if (layerMatch) {
      const [, fromLayer, toLayer] = layerMatch;
      console.log(`    ${pc.yellow((idx + 1) + '.')} ${fromLayer} → ${toLayer} ${pc.dim(`— ${v.file}`)}`);
    } else {
      console.log(`    ${pc.yellow((idx + 1) + '.')} ${v.file} → ${v.relatedFile || 'unknown'}`);
    }
  });

  console.log();
  console.log(pc.bold('  💡 Suggested Fix:'));
  console.log('     Respect layer hierarchy and use dependency inversion.');
  console.log('     Move shared logic to allowed layers or use interfaces.');
}

export function printForbiddenImportSummary(violations: Violation[]): void {
  console.log(pc.dim('  Impact: ') + 'Introduces unwanted dependencies and coupling');
  console.log();
  console.log(pc.dim('  Forbidden imports detected:'));
  
  violations.forEach((v, idx) => {
    const importMatch = v.message.match(/Importing "([^"]+)"/);
    const importName = importMatch ? importMatch[1] : 'unknown';
    console.log(`    ${pc.yellow((idx + 1) + '.')} ${importName} ${pc.dim(`— in ${v.file}`)}`);
  });

  console.log();
  console.log(pc.bold('  💡 Suggested Fix:'));
  console.log('     Remove forbidden imports or restructure code.');
  console.log('     Use dependency injection or refactor to avoid coupling.');
}
