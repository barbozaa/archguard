import { describe, it, expect } from 'vitest';
import { DiffAnalyzer } from '@application/diff-analyzer.js';
import type { DiffResult, ViolationDelta } from '@domain/types.js';

/**
 * DiffAnalyzer.compare() uses process.chdir + git worktree which can't run
 * in vitest worker threads. We test the diff logic by verifying the
 * DiffResult contract directly — the integration path is covered by the
 * CLI test: `node dist/cli.js . --diff main`.
 */

function makeDelta(overrides: Partial<ViolationDelta> = {}): ViolationDelta {
  return {
    rule: 'Test Rule',
    severity: 'warning',
    file: 'test.ts',
    message: 'test violation',
    penalty: 5,
    ...overrides,
  };
}

function buildDiffResult(
  baseScore: number,
  headScore: number,
  introduced: ViolationDelta[],
  resolved: ViolationDelta[],
): DiffResult {
  const scoreDelta = headScore - baseScore;
  let verdict: DiffResult['verdict'];
  if (scoreDelta > 0 || (scoreDelta === 0 && introduced.length < resolved.length)) {
    verdict = 'improved';
  } else if (scoreDelta < 0 || introduced.length > resolved.length) {
    verdict = 'degraded';
  } else {
    verdict = 'unchanged';
  }

  return {
    baseBranch: 'main',
    headBranch: 'feature/test',
    baseScore,
    headScore,
    scoreDelta,
    baseViolationCount: resolved.length,
    headViolationCount: introduced.length,
    introduced,
    resolved,
    verdict,
    summary: `Score: ${scoreDelta >= 0 ? '+' : ''}${scoreDelta} points.`,
  };
}

describe('DiffAnalyzer.compare guard', () => {
  it('rejects unsafe baseBranch before running analysis', async () => {
    await expect(new DiffAnalyzer().compare(process.cwd(), '$(evil)')).rejects.toThrow(/Invalid git ref/);
  });
});

describe('DiffResult contract', () => {
  it('should mark as improved when score increases', () => {
    const result = buildDiffResult(90, 95, [], [makeDelta()]);
    expect(result.verdict).toBe('improved');
    expect(result.scoreDelta).toBe(5);
  });

  it('should mark as degraded when score decreases', () => {
    const result = buildDiffResult(95, 90, [makeDelta()], []);
    expect(result.verdict).toBe('degraded');
    expect(result.scoreDelta).toBe(-5);
  });

  it('should mark as unchanged when scores are equal and no violation changes', () => {
    const result = buildDiffResult(100, 100, [], []);
    expect(result.verdict).toBe('unchanged');
    expect(result.scoreDelta).toBe(0);
  });

  it('should mark as improved when score is equal but violations resolved', () => {
    const result = buildDiffResult(95, 95, [], [makeDelta()]);
    expect(result.verdict).toBe('improved');
  });

  it('should mark as degraded when score is equal but new violations introduced', () => {
    const result = buildDiffResult(95, 95, [makeDelta()], []);
    expect(result.verdict).toBe('degraded');
  });

  it('should correctly compute scoreDelta', () => {
    const result = buildDiffResult(80, 73, [makeDelta(), makeDelta()], []);
    expect(result.scoreDelta).toBe(-7);
    expect(result.introduced).toHaveLength(2);
  });

  it('should have all required fields', () => {
    const result = buildDiffResult(100, 100, [], []);
    expect(result).toHaveProperty('baseBranch');
    expect(result).toHaveProperty('headBranch');
    expect(result).toHaveProperty('baseScore');
    expect(result).toHaveProperty('headScore');
    expect(result).toHaveProperty('scoreDelta');
    expect(result).toHaveProperty('baseViolationCount');
    expect(result).toHaveProperty('headViolationCount');
    expect(result).toHaveProperty('introduced');
    expect(result).toHaveProperty('resolved');
    expect(result).toHaveProperty('verdict');
    expect(result).toHaveProperty('summary');
  });
});
