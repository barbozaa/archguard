import pc from 'picocolors';
import { Reporter } from '@domain/reporter.js';
import { AnalysisResult, Violation } from '@domain/types.js';
import { groupViolationsByType } from '@presentation/utils/violation-utils.js';
import {
  getSeverityIcon,
  getSeverityColor,
  getStatusIcon,
  getStatusColor,
  getScoreColor,
  getScoreBar,
  formatPriority,
  getRiskColor,
  wrapText,
  getCouplingRiskLevel,
  getCouplingRiskColor,
} from '@presentation/formatters.js';
import {
  printLayerViolationSummary,
  printTooManyImportsSummary,
  printDataClumpsSummary,
  printShotgunSurgerySummary,
  printDuplicateCodeSummary,
  printGenericViolationSummary,
} from '@presentation/summaries/index.js';
import { generateNextActions } from '@application/action-generator.js';

const SEPARATOR_WIDTH = 54;

const SUMMARY_PRINTERS: Record<string, (violations: Violation[]) => void> = {
  'Layer Violation': printLayerViolationSummary,
  'Too Many Imports': printTooManyImportsSummary,
  'Data Clumps': printDataClumpsSummary,
  'Shotgun Surgery': printShotgunSurgerySummary,
  'Duplicate Code': printDuplicateCodeSummary,
};

/**
 * Professional terminal reporter with enterprise-ready output
 */
export class TerminalReporter implements Reporter {
  report(result: AnalysisResult, verbose: boolean): void {
    console.log();
    this.printHeader(result.projectName);
    console.log();
    this.printExecutiveSummary(result);
    console.log();
    this.printProjectStats(result);
    console.log();

    if (result.violations.length > 0) {
      this.printGroupedRisks(result);
      console.log();
      this.printNextActions(result);
      console.log();
    } else {
      this.printNoIssuesMessage();
      console.log();
    }

    if (verbose && result.violations.length > 0) {
      this.printDetailedViolations(result.violations);
      console.log();
    }
  }

  private printHeader(projectName?: string): void {
    console.log(pc.bold(pc.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')));
    if (projectName) {
      console.log(pc.bold(pc.cyan(`  ARCHGUARD — Analyzing ${pc.white(projectName)}`)));
    } else {
      console.log(pc.bold(pc.cyan('  ARCHGUARD — Architecture Analysis Report')));
    }
    console.log(pc.bold(pc.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')));
  }

  private printExecutiveSummary(result: AnalysisResult): void {
    console.log(pc.bold('📊 EXECUTIVE SUMMARY'));
    console.log(pc.dim('─'.repeat(SEPARATOR_WIDTH)));
    console.log();

    const scoreColor = getScoreColor(result.score);
    const scoreBar = getScoreBar(result.score);
    console.log(`  Architecture Score: ${scoreColor(pc.bold(result.score.toString()))} / 100  ${scoreBar}`);

    const statusIcon = getStatusIcon(result.status);
    const statusColor = getStatusColor(result.status);
    console.log(`  Health Status:      ${statusColor(`${statusIcon} ${result.status}`)}`);

    const riskLevel = this.getRiskLevel(result);
    const riskColor = getRiskColor(riskLevel);
    console.log(`  Risk Level:         ${riskColor(riskLevel)}`);

    if (result.violations.length > 0) {
      console.log(`  Primary Concern:    ${pc.yellow(this.getPrimaryConcern(result))}`);
    } else {
      console.log(`  Primary Concern:    ${pc.green('None — Excellent architecture!')}`);
    }

    if (result.scoreBreakdown) {
      console.log();
      this.printCategoryBreakdown(result);
    }
  }

  private printCategoryBreakdown(result: AnalysisResult): void {
    if (!result.scoreBreakdown) return;

    const { structural, design, hygiene } = result.scoreBreakdown;

    console.log(pc.dim('  Category Breakdown:'));
    console.log();

    console.log(`    ${this.getCategoryIcon(structural.impact)} Structural:  ${this.formatCategoryLine(structural)}`);
    console.log(`    ${this.getCategoryIcon(design.impact)} Design:      ${this.formatCategoryLine(design)}`);
    console.log(`    ${this.getCategoryIcon(hygiene.impact)} Hygiene:     ${this.formatCategoryLine(hygiene)}`);

    console.log();
    console.log(pc.dim('  Categories:'));
    console.log(pc.dim('    • Structural:  Layer violations'));
    console.log(pc.dim('    • Design:      Coupling smells (too many imports, data clumps, shotgun surgery)'));
    console.log(pc.dim('    • Hygiene:     Code duplication'));
    console.log();
    console.log(pc.dim('  Points: Penalty deducted from score (100 base). Impact: 🔴 HIGH | ⚠️  MEDIUM | ℹ️  LOW'));
  }

  private getCategoryIcon(impact: 'HIGH' | 'MEDIUM' | 'LOW'): string {
    if (impact === 'HIGH') return pc.red('🔴');
    if (impact === 'MEDIUM') return pc.yellow('⚠️ ');
    return pc.blue('ℹ️ ');
  }

  private formatCategoryLine(category: import('@domain/types.js').CategoryScore): string {
    const count = pc.dim(`${category.violations} issues`);
    const penalty = category.penalty > 0
      ? pc.red(`-${category.penalty.toFixed(1)} pts`)
      : pc.green('0 pts');
    const impact = this.formatImpact(category.impact);
    return `${count.padEnd(20)} ${penalty.padEnd(20)} ${impact}`;
  }

  private formatImpact(impact: 'HIGH' | 'MEDIUM' | 'LOW'): string {
    if (impact === 'HIGH') return pc.red('HIGH IMPACT');
    if (impact === 'MEDIUM') return pc.yellow('MEDIUM');
    return pc.dim('LOW');
  }

  private printProjectStats(result: AnalysisResult): void {
    console.log(pc.bold('📈 PROJECT STATISTICS'));
    console.log(pc.dim('─'.repeat(SEPARATOR_WIDTH)));
    console.log();

    console.log(`  Files Analyzed:        ${pc.bold(result.totalModules.toString())}`);
    const healthyPercent = Math.round(result.healthyModuleCount / result.totalModules * 100);
    console.log(`  Healthy Modules:       ${pc.green(`${result.healthyModuleCount} / ${result.totalModules}`)} ${pc.dim(`(${healthyPercent}%)`)}`);

    if (result.totalLOC) {
      console.log(`  Total Lines of Code:   ${pc.cyan(result.totalLOC.toLocaleString())}`);
    }

    if (result.couplingRisk && result.couplingRisk.totalModules > 0) {
      const { couplingRisk } = result;
      const riskLevel = getCouplingRiskLevel(couplingRisk.overallRisk);
      const riskColor = getCouplingRiskColor(couplingRisk.overallRisk);
      console.log(`  Coupling Risk:         ${riskColor(`${couplingRisk.overallRisk.toFixed(1)}/100`)} ${pc.dim(`[${riskLevel}]`)}`);
      console.log(`  Avg Dependencies:      ${pc.cyan(couplingRisk.projectAverageCe.toFixed(1))} modules/file`);
    }

    const grouped = groupViolationsByType(result.violations);
    console.log();
    const layerCount = grouped['Layer Violation']?.length || 0;
    console.log(`  Layer Violations:      ${layerCount > 0 ? pc.red(layerCount.toString()) : pc.green('0 ✅')}`);
  }

  private printNoIssuesMessage(): void {
    console.log(pc.bold(pc.green('✨ EXCELLENT!')));
    console.log(pc.dim('─'.repeat(SEPARATOR_WIDTH)));
    console.log();
    console.log(pc.green('  No architecture violations detected!'));
    console.log(pc.dim('  Your codebase follows architectural best practices.'));
  }

  private printGroupedRisks(result: AnalysisResult): void {
    console.log(pc.bold('🎯 RISK BREAKDOWN'));
    console.log(pc.dim('─'.repeat(SEPARATOR_WIDTH)));
    console.log();

    const grouped = groupViolationsByType(result.violations);
    const sortedTypes = Object.keys(grouped).sort((a, b) => {
      const aWeight = this.getSeverityWeight(grouped[a][0].severity);
      const bWeight = this.getSeverityWeight(grouped[b][0].severity);
      return bWeight - aWeight;
    });

    for (const type of sortedTypes) {
      const violations = grouped[type];
      const icon = getSeverityIcon(violations[0].severity);
      const color = getSeverityColor(violations[0].severity);

      console.log(color(`  ${icon} ${type.toUpperCase()} (${violations.length})`));
      console.log(pc.dim('  ' + '─'.repeat(52)));

      const printer = SUMMARY_PRINTERS[type] ?? printGenericViolationSummary;
      printer(violations);
      console.log();
    }
  }

  private printNextActions(result: AnalysisResult): void {
    console.log(pc.bold('🔧 RECOMMENDED ACTIONS'));
    console.log(pc.dim('─'.repeat(SEPARATOR_WIDTH)));
    console.log();

    const actions = generateNextActions(result);
    actions.forEach((action, idx) => {
      console.log(`  ${pc.cyan((idx + 1) + '.')} ${action.description}`);
      console.log(`     ${pc.dim('Priority:')} ${formatPriority(action.priority)} ${pc.dim('│')} ${pc.dim('Effort:')} ${action.effort}`);
      if (action.impact) {
        console.log(`     ${pc.dim('Impact:')} ${action.impact}`);
      }
      if (action.file) {
        const linkText = action.line ? `${action.file}:${action.line}` : action.file;
        console.log(`     ${pc.dim('File:')} ${pc.blue(linkText)}`);
      }
      console.log();
    });

    console.log(pc.dim('  💡 Tip: Address high-priority items first for maximum impact.'));
  }

  private printDetailedViolations(violations: Violation[]): void {
    console.log(pc.bold('📋 DETAILED VIOLATION LIST'));
    console.log(pc.dim('─'.repeat(SEPARATOR_WIDTH)));
    console.log();

    for (const violation of violations) {
      const icon = getSeverityIcon(violation.severity);
      const color = getSeverityColor(violation.severity);

      console.log(color(`${icon} ${violation.rule.toUpperCase()}`));
      const fileLocation = violation.line ? `${violation.file}:${violation.line}` : violation.file;
      console.log(pc.dim(fileLocation));

      if (violation.relatedFile) {
        console.log(pc.dim('   ↓ imports'));
        console.log(pc.dim(violation.relatedFile));
      }

      console.log();
      console.log(pc.dim(violation.message));
      console.log();
      console.log(pc.bold('Why this matters:'));
      console.log(wrapText(violation.impact, 50));
      console.log();
      console.log(pc.bold('Suggested fix:'));
      console.log(pc.green(wrapText(violation.suggestedFix, 50)));

      console.log(pc.dim('─'.repeat(SEPARATOR_WIDTH)));
      console.log();
    }
  }

  private getRiskLevel(result: AnalysisResult): string {
    if (result.criticalCount > 0) return 'HIGH';
    if (result.warningCount > 5) return 'MEDIUM';
    if (result.warningCount > 0) return 'LOW';
    return 'MINIMAL';
  }

  private getPrimaryConcern(result: AnalysisResult): string {
    const grouped = groupViolationsByType(result.violations);
    const ordered = ['Layer Violation', 'Too Many Imports', 'Shotgun Surgery', 'Data Clumps', 'Duplicate Code'];

    for (const type of ordered) {
      const violations = grouped[type];
      if (violations && violations.length > 0) {
        return `${type} — ${violations.length} ${violations.length === 1 ? 'issue' : 'issues'}`;
      }
    }

    const topType = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length)[0];
    return `${topType} — ${grouped[topType].length} issues`;
  }

  private getSeverityWeight(severity: string): number {
    return severity === 'critical' ? 3 : severity === 'warning' ? 2 : 1;
  }

}
