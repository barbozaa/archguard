import { Violation, NextAction } from '@domain/types.js';
import { getFileName } from '@presentation/formatters.js';

export function generateLayerViolationActions(violations: Violation[]): NextAction[] {
  return violations.map(v => {
    const files = v.relatedFile
      ? `${getFileName(v.file)} → ${getFileName(v.relatedFile)}`
      : getFileName(v.file);
    return {
      description: `Fix layer violation: ${files}`,
      priority: 'HIGH',
      effort: '1-2h',
      impact: 'Maintains architectural boundaries',
    };
  });
}

export function generateTooManyImportsActions(violations: Violation[]): NextAction[] {
  return violations
    .map(v => ({
      v,
      file: v.file,
      fileName: getFileName(v.file),
      count: parseInt(v.message.match(/(\d+) imports/)?.[1] || '0'),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(item => ({
      description: `Refactor high coupling: ${item.fileName} (${item.count} imports)`,
      priority: 'HIGH',
      effort: '4-8h',
      impact: 'Reduces coupling and improves modularity',
      file: item.file,
      line: 1,
    }));
}

export function generateDataClumpsActions(violations: Violation[]): NextAction[] {
  return violations.slice(0, 3).map(v => {
    const paramsMatch = v.message.match(/parameters \(([^)]+)\)/);
    const params = paramsMatch ? paramsMatch[1] : 'unknown params';
    return {
      description: `Extract data clump (${params}) into a dedicated type`,
      priority: 'MEDIUM',
      effort: '1-3h',
      impact: 'Reduces parameter duplication and clarifies domain model',
      file: v.file,
      line: v.line,
    };
  });
}

export function generateShotgunSurgeryActions(violations: Violation[]): NextAction[] {
  return violations
    .map(v => ({
      v,
      fileCount: parseInt(v.message.match(/used in (\d+) files/)?.[1] || '0'),
      symbol: v.message.match(/Symbol '([^']+)'/)?.[1] || 'unknown',
    }))
    .sort((a, b) => b.fileCount - a.fileCount)
    .slice(0, 3)
    .map(item => ({
      description: `Reduce spread of '${item.symbol}' — used in ${item.fileCount} files`,
      priority: item.fileCount >= 10 ? 'HIGH' : 'MEDIUM',
      effort: '2-4h',
      impact: 'Reduces change propagation risk across the codebase',
      file: item.v.file,
    }));
}
