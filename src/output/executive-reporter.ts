import pc from 'picocolors';
import { basename } from 'path';
import { Reporter } from './reporter-interface.js';
import { AnalysisResult, Violation } from '@core/types.js';
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
  private static readonly BOX_INNER_WIDTH = 70; // Width inside the box accounting for emoji visual width
  private static readonly TOP_CRITICAL_LIMIT = 5;
  private static readonly TOP_WARNINGS_LIMIT = 3;
  private static readonly TOP_RULES_LIMIT = 3;
  private static readonly SCORE_IMPROVEMENT_TARGET = 15;
  private static readonly PENALTY_IMPROVEMENT_FACTOR = 0.6;

  private readonly scoreCalculator = new ScoreCalculator();

  /**
   * Remove ANSI color codes to get actual text length
   */
  private stripAnsi(str: string): string {
    return str.replace(/\u001b\[[0-9;]*m/g, '');
  }

  /**
   * Get the actual character count using Array.from to handle Unicode properly
   */
  private getPlainTextLength(str: string): number {
    const plain = this.stripAnsi(str);
    return Array.from(plain).length;
  }

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
    const grade = this.scoreCalculator.getGrade(result.architectureScore);
    const scoreColor = getScoreColor(result.architectureScore);
    const statusIcon = getStatusIcon(result.status);
    const statusColor = getStatusColor(result.status);

    console.log(pc.bold('┌─────────────────────────────────────────────────────────────────────────┐'));
    
    // Architecture Health Score
    const titleText = `ARCHITECTURE HEALTH: ${scoreColor(pc.bold(result.architectureScore.toString()))} / 100  [${grade}]`;
    const titleLen = this.getPlainTextLength(titleText);
    console.log(pc.bold(`│  ${titleText}${' '.repeat(ExecutiveReporter.BOX_INNER_WIDTH - titleLen)} │`));
    
    // Hygiene Score
    const hygieneGrade = this.scoreCalculator.getGrade(result.hygieneScore);
    const hygieneColor = getScoreColor(result.hygieneScore);
    const hygText = `HYGIENE SCORE: ${hygieneColor(result.hygieneScore.toString())} / 100  [${hygieneGrade}]`;
    const hygLen = this.getPlainTextLength(hygText);
    console.log(pc.bold(`│  ${hygText}${' '.repeat(ExecutiveReporter.BOX_INNER_WIDTH - hygLen)} │`));
    
    console.log(pc.bold('│                                                                         │'));
    
    // Status line
    const statusText = `Status: ${statusColor(`${statusIcon} ${result.status}`)}`;
    const statusLen = this.getPlainTextLength(statusText);
    console.log(pc.bold(`│  ${statusText}${' '.repeat(ExecutiveReporter.BOX_INNER_WIDTH - statusLen - 1)} │`));
    
    // Confidence level
    if (result.confidenceLevel) {
      const confColor = result.confidenceLevel === 'HIGH' ? pc.green : result.confidenceLevel === 'MEDIUM' ? pc.yellow : pc.red;
      const confText = `Confidence: ${confColor(result.confidenceLevel)} (${result.modulesAnalyzedPercent?.toFixed(0)}% analyzed)`;
      const confLen = this.getPlainTextLength(confText);
      console.log(pc.bold(`│  ${confText}${' '.repeat(ExecutiveReporter.BOX_INNER_WIDTH - confLen)} │`));
    }
    
    if (result.scoreBreakdown) {
      console.log(pc.bold('│                                                                         │'));
      console.log(pc.bold('│  Architecture Components (weighted):                                    │'));
      
      const { structural, design, complexity, hygiene } = result.scoreBreakdown;
      
      if (structural.violations > 0) {
        const impact = structural.impact === 'HIGH' ? pc.red('HIGH RISK') : structural.impact;
        const text = `  🔴 Structural (40%):  ${structural.violations} issues  -${structural.penalty.toFixed(1)} pts  ${impact}`;
        const len = this.getPlainTextLength(text);
        console.log(pc.bold(`│  ${text}${' '.repeat(ExecutiveReporter.BOX_INNER_WIDTH - len)} │`));
      }
      if (design.violations > 0) {
        const impact = design.impact === 'HIGH' ? pc.yellow('MEDIUM RISK') : design.impact;
        const text = `  ⚠️  Design (30%):      ${design.violations} issues  -${design.penalty.toFixed(1)} pts  ${impact}`;
        const len = this.getPlainTextLength(text);
        console.log(pc.bold(`│  ${text}${' '.repeat(ExecutiveReporter.BOX_INNER_WIDTH - len + 1)} │`));
      }
      if (complexity.violations > 0) {
        const text = `  ℹ️  Complexity (20%):  ${complexity.violations} issues  -${complexity.penalty.toFixed(1)} pts`;
        const len = this.getPlainTextLength(text);
        console.log(pc.bold(`│  ${text}${' '.repeat(ExecutiveReporter.BOX_INNER_WIDTH - len + 1)} │`));
      }
      
      console.log(pc.bold('│                                                                         │'));
      console.log(pc.bold('│  Code Hygiene (separate metric):                                        │'));
      
      if (hygiene.violations > 0) {
        const text = `  🧹 Hygiene (10%):     ${hygiene.violations} issues  -${hygiene.penalty.toFixed(1)} pts`;
        const len = this.getPlainTextLength(text);
        console.log(pc.bold(`│  ${text}${' '.repeat(ExecutiveReporter.BOX_INNER_WIDTH - len - 1)} │`));
      }
    }
    
    // Add coupling risk metrics if available
    if (result.couplingRisk && result.couplingRisk.totalModules > 0) {
      console.log(pc.bold('│                                                                         │'));
      console.log(pc.bold('│  Coupling Metrics:                                                      │'));
      
      const { couplingRisk } = result;
      const riskLevel = this.getRiskLevel(couplingRisk.overallRisk);
      const riskColor = this.getRiskColor(couplingRisk.overallRisk);
      
      const riskText = `  🔥 Coupling Risk: ${riskColor(couplingRisk.overallRisk.toFixed(1))}/100 [${riskLevel}]`;
      const riskLen = this.getPlainTextLength(riskText);
      console.log(pc.bold(`│  ${riskText}${' '.repeat(ExecutiveReporter.BOX_INNER_WIDTH - riskLen - 1)} │`));
      
      const modulesText = `     ${couplingRisk.totalModules} modules, ${couplingRisk.projectAverageCe.toFixed(1)} avg deps, ${(couplingRisk.projectAverageInstability * 100).toFixed(0)}% instability`;
      const modulesLen = this.getPlainTextLength(modulesText);
      console.log(pc.bold(`│  ${modulesText}${' '.repeat(ExecutiveReporter.BOX_INNER_WIDTH - modulesLen)} │`));
    }
    
    // Add blast radius if available
    if (result.blastRadius && result.blastRadius.length > 0) {
      console.log(pc.bold('│                                                                         │'));
      console.log(pc.bold('│  ⚡ Blast Radius (Top Change Impact):                                   │'));
      const top3 = result.blastRadius.slice(0, 3);
      top3.forEach(module => {
        const fileName = basename(module.modulePath);
        const impactText = `     ${fileName} → ${module.affectedModules} modules affected`;
        const impactLen = this.getPlainTextLength(impactText);
        console.log(pc.bold(`│  ${impactText}${' '.repeat(ExecutiveReporter.BOX_INNER_WIDTH - impactLen)} │`));
      });
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

  private getRiskLevel(risk: number): string {
    if (risk >= 75) return 'EXTREME';
    if (risk >= 50) return 'HIGH';
    if (risk >= 25) return 'MEDIUM';
    return 'LOW';
  }

  private getRiskColor(risk: number): (text: string) => string {
    if (risk >= 75) return pc.red;
    if (risk >= 50) return pc.yellow;
    if (risk >= 25) return pc.cyan;
    return pc.green;
  }
}

