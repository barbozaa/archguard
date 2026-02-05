import pc from 'picocolors';
import { Reporter } from './reporter-interface.js';
import { AnalysisResult, Violation } from '../core/types.js';
import { ScoreCalculator } from './score-calculator.js';
import {
  getSeverityIcon,
  getStatusIcon,
  getStatusColor,
  getScoreColor,
} from './formatters.js';

/**
 * Executive summary reporter - condensed view for leadership and architects
 * Focuses on critical issues and high-level metrics only
 */
export class ExecutiveReporter implements Reporter {
  private static readonly REPORT_WIDTH = 78;
  private static readonly PADDING_WITH_BORDER = 92;
  private static readonly PADDING_WITH_ICONS = 90;
  private static readonly TOP_CRITICAL_LIMIT = 5;
  private static readonly TOP_WARNINGS_LIMIT = 3;
  private static readonly TOP_RULES_LIMIT = 3;
  private static readonly SCORE_IMPROVEMENT_TARGET = 15;
  private static readonly PENALTY_IMPROVEMENT_FACTOR = 0.6;

  private readonly scoreCalculator = new ScoreCalculator();

  report(result: AnalysisResult, _: boolean): void {
    console.log();
    this.printExecutiveHeader(result);
    console.log();
    this.printArchitectureScore(result);
    console.log();
    
    if (result.violations.length > 0) {
      this.printCriticalIssues(result);
      console.log();
      this.printImmediateActions(result);
    } else {
      this.printExcellenceMessage();
    }
    
    console.log();
  }

  private printExecutiveHeader(result: AnalysisResult): void {
    const border = '═'.repeat(ExecutiveReporter.REPORT_WIDTH);
    console.log(pc.cyan(border));
    console.log(pc.bold(pc.cyan('  ARCHGUARD — EXECUTIVE ARCHITECTURE REPORT')));
    if (result.projectName) {
      console.log(pc.cyan(`  Project: ${pc.white(result.projectName)}`));
    }
    const date = new Date(result.timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    console.log(pc.dim(`  Analysis Date: ${date}`));
    console.log(pc.cyan(border));
  }

  private printArchitectureScore(result: AnalysisResult): void {
    const grade = this.scoreCalculator.getGrade(result.score);
    const scoreColor = getScoreColor(result.score);
    const statusIcon = getStatusIcon(result.status);
    const statusColor = getStatusColor(result.status);

    console.log(pc.bold('┌─────────────────────────────────────────────────────────────────────────┐'));
    console.log(pc.bold(`│  ARCHITECTURE HEALTH SCORE: ${scoreColor(pc.bold(result.score.toString()))} / 100  [${grade}]`).padEnd(ExecutiveReporter.PADDING_WITH_BORDER) + pc.bold('│'));
    console.log(pc.bold('│                                                                         │'));
    console.log(pc.bold(`│  Status: ${statusColor(`${statusIcon} ${result.status}`)}`.padEnd(ExecutiveReporter.PADDING_WITH_BORDER)) + pc.bold('│'));
    
    if (result.scoreBreakdown) {
      console.log(pc.bold('│                                                                         │'));
      console.log(pc.bold('│  Risk Breakdown:                                                        │'));
      
      const { structural, design, complexity, hygiene } = result.scoreBreakdown;
      
      if (structural.violations > 0) {
        const impact = structural.impact === 'HIGH' ? pc.red('HIGH RISK') : structural.impact;
        console.log(pc.bold(`│    🔴 Structural:  ${structural.violations} issues  -${structural.penalty.toFixed(1)} pts  ${impact}`.padEnd(ExecutiveReporter.PADDING_WITH_ICONS)) + pc.bold('│'));
      }
      if (design.violations > 0) {
        const impact = design.impact === 'HIGH' ? pc.yellow('MEDIUM RISK') : design.impact;
        console.log(pc.bold(`│    ⚠️  Design:      ${design.violations} issues  -${design.penalty.toFixed(1)} pts  ${impact}`.padEnd(ExecutiveReporter.PADDING_WITH_ICONS)) + pc.bold('│'));
      }
      if (complexity.violations > 0) {
        console.log(pc.bold(`│    ℹ️  Complexity:  ${complexity.violations} issues  -${complexity.penalty.toFixed(1)} pts`.padEnd(ExecutiveReporter.PADDING_WITH_ICONS)) + pc.bold('│'));
      }
      if (hygiene.violations > 0) {
        console.log(pc.bold(`│    🧹 Hygiene:     ${hygiene.violations} issues  -${hygiene.penalty.toFixed(1)} pts`.padEnd(ExecutiveReporter.PADDING_WITH_ICONS)) + pc.bold('│'));
      }
    }
    
    console.log(pc.bold('└─────────────────────────────────────────────────────────────────────────┘'));
  }

  private printCriticalIssues(result: AnalysisResult): void {
    const criticalViolations = result.violations.filter(v => v.severity === 'critical');
    
    if (criticalViolations.length === 0) {
      console.log(pc.bold('🎯 CRITICAL ISSUES'));
      console.log(pc.dim('─'.repeat(ExecutiveReporter.REPORT_WIDTH)));
      console.log();
      console.log(pc.green('  ✓ No critical architectural issues detected'));
      return;
    }

    console.log(pc.bold(pc.red('⛔ IMMEDIATE ACTION REQUIRED')));
    console.log(pc.dim('─'.repeat(ExecutiveReporter.REPORT_WIDTH)));
    console.log();
    console.log(pc.red(`  ${criticalViolations.length} CRITICAL architectural issues detected`));
    console.log();

    // Show top critical issues
    const topCritical = criticalViolations.slice(0, ExecutiveReporter.TOP_CRITICAL_LIMIT);
    
    topCritical.forEach((violation, index) => {
      console.log(pc.bold(`  ${index + 1}. ${pc.red(getSeverityIcon(violation.severity))} ${violation.rule}`));
      console.log(pc.dim(`     Location: ${violation.file}${violation.line ? `:${violation.line}` : ''}`));
      if (violation.relatedFile) {
        console.log(pc.dim(`     Related:  ${violation.relatedFile}`));
      }
      console.log();
      console.log(pc.yellow(`     Impact: ${violation.impact}`));
      console.log();
    });

    if (criticalViolations.length > ExecutiveReporter.TOP_CRITICAL_LIMIT) {
      console.log(pc.dim(`  ... and ${criticalViolations.length - ExecutiveReporter.TOP_CRITICAL_LIMIT} more critical issues`));
      console.log();
    }
  }

  private printImmediateActions(result: AnalysisResult): void {
    console.log(pc.bold('🎯 IMMEDIATE ACTIONS'));
    console.log(pc.dim('─'.repeat(ExecutiveReporter.REPORT_WIDTH)));
    console.log();

    const criticalViolations = result.violations.filter(v => v.severity === 'critical');
    const highWarnings = result.violations
      .filter(v => v.severity === 'warning')
      .sort((a, b) => b.penalty - a.penalty)
      .slice(0, ExecutiveReporter.TOP_WARNINGS_LIMIT);

    if (criticalViolations.length > 0) {
      console.log(pc.bold('  THIS SPRINT (Critical):'));
      console.log();
      
      const grouped = this.groupByRule(criticalViolations);
      const topRules = Object.entries(grouped)
        .sort(([, a], [, b]) => b.length - a.length)
        .slice(0, ExecutiveReporter.TOP_RULES_LIMIT);

      topRules.forEach(([rule, violations], index) => {
        const estimatedEffort = this.estimateEffort(violations.length);
        console.log(`  ${index + 1}. ${pc.red('☑')} Fix ${violations.length} ${rule} issue${violations.length > 1 ? 's' : ''}`);
        console.log(pc.dim(`     Estimated effort: ${estimatedEffort}`));
        console.log(pc.dim(`     Expected score impact: +${this.estimateScoreImprovement(violations)} points`));
        console.log();
      });
    }

    if (highWarnings.length > 0) {
      console.log(pc.bold('  NEXT 2-4 WEEKS (High Priority):'));
      console.log();
      
      highWarnings.forEach((violation, index) => {
        console.log(`  ${index + 1}. ${pc.yellow('☑')} Address ${violation.rule}`);
        console.log(pc.dim(`     ${violation.file}${violation.line ? `:${violation.line}` : ''}`));
        console.log();
      });
    }

    const targetScore = Math.min(100, result.score + ExecutiveReporter.SCORE_IMPROVEMENT_TARGET);
    console.log(pc.dim(`  Target for next analysis: ${targetScore}/100`));
  }

  private printExcellenceMessage(): void {
    console.log(pc.bold(pc.green('✅ ARCHITECTURAL EXCELLENCE')));
    console.log(pc.dim('─'.repeat(ExecutiveReporter.REPORT_WIDTH)));
    console.log();
    console.log(pc.green('  Your architecture is in excellent condition.'));
    console.log(pc.green('  No critical issues detected.'));
    console.log();
    console.log(pc.dim('  Continue maintaining this high standard through:'));
    console.log(pc.dim('  • Regular architecture reviews'));
    console.log(pc.dim('  • Continuous monitoring of metrics'));
    console.log(pc.dim('  • Proactive refactoring of emerging issues'));
    console.log();
  }

  private groupByRule(violations: Violation[]): Record<string, Violation[]> {
    const grouped: Record<string, Violation[]> = {};
    
    for (const violation of violations) {
      if (!grouped[violation.rule]) {
        grouped[violation.rule] = [];
      }
      grouped[violation.rule].push(violation);
    }
    
    return grouped;
  }

  private estimateEffort(count: number): string {
    if (count === 1) return '2-4 hours';
    if (count <= 3) return '1-2 days';
    if (count <= 5) return '2-3 days';
    if (count <= 10) return '1 week';
    return '1-2 weeks';
  }

  private estimateScoreImprovement(violations: Violation[]): number {
    const totalPenalty = violations.reduce((sum, v) => sum + v.penalty, 0);
    return Math.round(totalPenalty * ExecutiveReporter.PENALTY_IMPROVEMENT_FACTOR);
  }
}
