import { describe, it, expect } from 'vitest';
import {
  generateLayerViolationActions,
  generateTooManyImportsActions,
  generateDataClumpsActions,
  generateShotgunSurgeryActions,
} from '@application/action-generators.js';
import type { Violation } from '@domain/types.js';

const makeViolation = (overrides: Partial<Violation>): Violation => ({
  message: 'violation',
  file: 'src/file.ts',
  line: 1,
  severity: 'warning',
  rule: 'test',
  impact: 'impact',
  suggestedFix: 'fix',
  penalty: 5,
  ...overrides,
});

describe('generateLayerViolationActions', () => {
  it('returns one action per violation', () => {
    const violations = [
      makeViolation({ rule: 'layer-violation', file: 'ui.ts', relatedFile: 'data.ts' }),
    ];
    const actions = generateLayerViolationActions(violations);
    expect(actions).toHaveLength(1);
    expect(actions[0].priority).toBe('HIGH');
  });

  it('returns empty array for no violations', () => {
    expect(generateLayerViolationActions([])).toHaveLength(0);
  });
});

describe('generateTooManyImportsActions', () => {
  it('returns actions sorted by import count, capped at 3', () => {
    const violations = [
      makeViolation({ rule: 'too-many-imports', message: 'File has 20 imports (max: 15)', file: 'a.ts' }),
      makeViolation({ rule: 'too-many-imports', message: 'File has 30 imports (max: 15)', file: 'b.ts' }),
      makeViolation({ rule: 'too-many-imports', message: 'File has 16 imports (max: 15)', file: 'c.ts' }),
      makeViolation({ rule: 'too-many-imports', message: 'File has 25 imports (max: 15)', file: 'd.ts' }),
    ];
    const actions = generateTooManyImportsActions(violations);
    expect(actions.length).toBeLessThanOrEqual(3);
    expect(actions[0].description).toContain('30');
  });

  it('returns empty array for no violations', () => {
    expect(generateTooManyImportsActions([])).toHaveLength(0);
  });
});

describe('generateDataClumpsActions', () => {
  it('returns actions with MEDIUM priority', () => {
    const violations = [
      makeViolation({ rule: 'data-clumps', message: 'Found data clump with 3 parameters (start, end, ctx) appearing in 4 locations.' }),
    ];
    const actions = generateDataClumpsActions(violations);
    expect(actions).toHaveLength(1);
    expect(actions[0].priority).toBe('MEDIUM');
  });

  it('returns empty array for no violations', () => {
    expect(generateDataClumpsActions([])).toHaveLength(0);
  });
});

describe('generateShotgunSurgeryActions', () => {
  it('returns HIGH priority for symbols used in >= 10 files', () => {
    const violations = [
      makeViolation({ rule: 'shotgun-surgery', message: "Symbol 'MyService' from utils.ts is used in 12 files: a, b, c" }),
    ];
    const actions = generateShotgunSurgeryActions(violations);
    expect(actions).toHaveLength(1);
    expect(actions[0].priority).toBe('HIGH');
  });

  it('returns MEDIUM priority for symbols used in < 10 files', () => {
    const violations = [
      makeViolation({ rule: 'shotgun-surgery', message: "Symbol 'helper' from utils.ts is used in 6 files: a, b, c" }),
    ];
    const actions = generateShotgunSurgeryActions(violations);
    expect(actions[0].priority).toBe('MEDIUM');
  });

  it('returns empty array for no violations', () => {
    expect(generateShotgunSurgeryActions([])).toHaveLength(0);
  });
});
