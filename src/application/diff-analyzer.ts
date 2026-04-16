import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { analyzeProject } from './analyze-project.js';
import { AnalysisResult, DiffResult, Violation, ViolationDelta } from '@domain/types.js';

/**
 * Compares architecture between two git branches using git worktree.
 *
 * Flow:
 *   1. Analyze the current working tree (head)
 *   2. Create a temporary git worktree for the base branch
 *   3. Analyze the base worktree
 *   4. Diff violations and scores
 *   5. Clean up the worktree
 */
export class DiffAnalyzer {
  async compare(
    projectPath: string,
    baseBranch: string,
    configPath?: string,
  ): Promise<DiffResult> {
    const headBranch = this.getCurrentBranch(projectPath);
    const headResult = await analyzeProject(projectPath, configPath);

    let baseResult: AnalysisResult;
    const worktreeDir = mkdtempSync(join(tmpdir(), 'archguard-diff-'));

    try {
      this.createWorktree(projectPath, worktreeDir, baseBranch);
      baseResult = await analyzeProject(worktreeDir, configPath);
    } finally {
      this.removeWorktree(projectPath, worktreeDir);
      rmSync(worktreeDir, { recursive: true, force: true });
    }

    return this.buildDiff(baseBranch, headBranch, baseResult, headResult);
  }

  // -----------------------------------------------------------------------
  // Git helpers
  // -----------------------------------------------------------------------

  private getCurrentBranch(cwd: string): string {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf-8' }).trim();
    } catch {
      return 'HEAD';
    }
  }

  private createWorktree(repoCwd: string, targetDir: string, branch: string): void {
    try {
      execSync(`git worktree add --detach "${targetDir}" "${branch}"`, {
        cwd: repoCwd,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (error) {
      throw new Error(
        `Failed to create git worktree for branch "${branch}". ` +
        `Make sure the branch exists and the repo is clean.\n` +
        `${error instanceof Error ? error.message : error}`
      );
    }
  }

  private removeWorktree(repoCwd: string, targetDir: string): void {
    try {
      execSync(`git worktree remove --force "${targetDir}"`, {
        cwd: repoCwd,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch {
      // Best-effort cleanup; rmSync in the caller handles the directory
    }
  }

  // -----------------------------------------------------------------------
  // Diff logic
  // -----------------------------------------------------------------------

  private buildDiff(
    baseBranch: string,
    headBranch: string,
    base: AnalysisResult,
    head: AnalysisResult,
  ): DiffResult {
    const baseKeys = new Set(base.violations.map(v => this.violationKey(v)));
    const headKeys = new Set(head.violations.map(v => this.violationKey(v)));

    const introduced = head.violations
      .filter(v => !baseKeys.has(this.violationKey(v)))
      .map(this.toDelta);

    const resolved = base.violations
      .filter(v => !headKeys.has(this.violationKey(v)))
      .map(this.toDelta);

    const scoreDelta = head.score - base.score;

    let verdict: DiffResult['verdict'];
    if (scoreDelta > 0 || (scoreDelta === 0 && introduced.length < resolved.length)) {
      verdict = 'improved';
    } else if (scoreDelta < 0 || introduced.length > resolved.length) {
      verdict = 'degraded';
    } else {
      verdict = 'unchanged';
    }

    const summary = this.buildSummary(scoreDelta, introduced.length, resolved.length, verdict);

    return {
      baseBranch,
      headBranch,
      baseScore: base.score,
      headScore: head.score,
      scoreDelta,
      baseViolationCount: base.violations.length,
      headViolationCount: head.violations.length,
      introduced,
      resolved,
      verdict,
      summary,
    };
  }

  /**
   * Identity key for a violation. Uses rule + file + normalized message
   * so that minor line shifts don't create false "new" violations.
   */
  private violationKey(v: Violation): string {
    return `${v.rule}::${v.file}::${v.message}`;
  }

  private toDelta(v: Violation): ViolationDelta {
    return {
      rule: v.rule,
      severity: v.severity,
      file: v.file,
      message: v.message,
      line: v.line,
      penalty: v.penalty,
    };
  }

  private buildSummary(
    scoreDelta: number,
    introduced: number,
    resolved: number,
    verdict: DiffResult['verdict'],
  ): string {
    const deltaStr = scoreDelta >= 0 ? `+${scoreDelta}` : `${scoreDelta}`;
    const parts: string[] = [`Score: ${deltaStr} points.`];

    if (introduced > 0) {
      parts.push(`${introduced} new violation${introduced > 1 ? 's' : ''} introduced.`);
    }
    if (resolved > 0) {
      parts.push(`${resolved} violation${resolved > 1 ? 's' : ''} resolved.`);
    }
    if (introduced === 0 && resolved === 0) {
      parts.push('No violation changes.');
    }

    if (verdict === 'degraded') {
      parts.push('Architecture health DEGRADED.');
    } else if (verdict === 'improved') {
      parts.push('Architecture health IMPROVED.');
    }

    return parts.join(' ');
  }
}
