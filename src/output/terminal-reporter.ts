import pc from 'picocolors';
import { Reporter } from './reporter-interface.js';
import { AnalysisResult, Violation } from '../core/types.js';
import { groupViolationsByType } from './utils/violation-utils.js';
import {
  getSeverityIcon,
  getSeverityColor,
  getStatusIcon,
  getStatusColor,
  getScoreColor,
  getScoreBar,
  formatPriority,
  getRiskColor,
  wrapText
} from './formatters.js';
import {
  printGodFileSummary,
  printCircularDepSummary,
  printMissingTestsSummary,
  printTooManyImportsSummary,
  printLargeFunctionSummary,
  printDeepNestingSummary,
  printSkippedTestsSummary,
  printMagicNumbersSummary,
  printWildcardImportsSummary,
  printTodoCommentsSummary,
  printUnusedExportsSummary,
  printMissingTypeAnnotationsSummary,
  printCyclomaticComplexitySummary,
  printDuplicateCodeSummary,
  printLayerViolationSummary,
  printForbiddenImportSummary,
  printDeadCodeSummary,
  printLongParameterListSummary,
  printFeatureEnvySummary,
  printDataClumpsSummary,
  printShotgunSurgerySummary,
  printGenericViolationSummary
} from './violation-summaries.js';
import { generateNextActions } from './action-generator.js';

// UI Constants
const SEPARATOR_WIDTH: number = 54;

interface GroupedViolations {
  [key: string]: Violation[];
}

// Map violation types to their summary printers
const SUMMARY_PRINTERS: Record<string, (violations: Violation[]) => void> = {
  'God File': printGodFileSummary,
  'Circular Dependency': printCircularDepSummary,
  'Missing Test File': printMissingTestsSummary,
  'Too Many Imports': printTooManyImportsSummary,
  'Large Function': printLargeFunctionSummary,
  'Deep Nesting': printDeepNestingSummary,
  'Skipped Test': printSkippedTestsSummary,
  'Magic Number': printMagicNumbersSummary,
  'Wildcard Import': printWildcardImportsSummary,
  'Technical Debt Marker': printTodoCommentsSummary,
  'Unused Export': printUnusedExportsSummary,
  'Missing Type Annotation': printMissingTypeAnnotationsSummary,
  'High Cyclomatic Complexity': printCyclomaticComplexitySummary,
  'Duplicate Code': printDuplicateCodeSummary,
  'Layer Violation': printLayerViolationSummary,
  'Forbidden Import': printForbiddenImportSummary,
  'Dead Code': printDeadCodeSummary,
  'Long Parameter List': printLongParameterListSummary,
  'Feature Envy': printFeatureEnvySummary,
  'Data Clump': printDataClumpsSummary,
  'Shotgun Surgery': printShotgunSurgerySummary,
};

/**
 * Professional terminal reporter with beautiful, enterprise-ready output
 * Orchestrates formatting, summaries, and action generation
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

    // Score with visual indicator
    const scoreColor = getScoreColor(result.score);
    const scoreBar = getScoreBar(result.score);
    console.log(`  Architecture Score: ${scoreColor(pc.bold(result.score.toString()))} / 100  ${scoreBar}`);
    
    const statusIcon = getStatusIcon(result.status);
    const statusColor = getStatusColor(result.status);
    console.log(`  Health Status:      ${statusColor(`${statusIcon} ${result.status}`)}`);
    
    // Risk level
    const riskLevel = this.getRiskLevel(result);
    const riskColor = getRiskColor(riskLevel);
    console.log(`  Risk Level:         ${riskColor(riskLevel)}`);
    
    // Primary concern
    if (result.violations.length > 0) {
      const primaryConcern = this.getPrimaryConcern(result);
      console.log(`  Primary Concern:    ${pc.yellow(primaryConcern)}`);
    } else {
      console.log(`  Primary Concern:    ${pc.green('None — Excellent architecture!')}`);
    }

    // Show category breakdown if available
    if (result.scoreBreakdown) {
      console.log();
      this.printCategoryBreakdown(result);
    }
  }

  private printCategoryBreakdown(result: AnalysisResult): void {
    if (!result.scoreBreakdown) return;

    const { structural, design, complexity, hygiene } = result.scoreBreakdown;

    console.log(pc.dim('  Category Breakdown:'));
    console.log();

    // Structural
    const structuralIcon = this.getCategoryIcon(structural.impact);
    console.log(`    ${structuralIcon} Structural:   ${this.formatCategoryLine(structural)}`);
    
    // Design
    const designIcon = this.getCategoryIcon(design.impact);
    console.log(`    ${designIcon} Design:       ${this.formatCategoryLine(design)}`);
    
    // Complexity
    const complexityIcon = this.getCategoryIcon(complexity.impact);
    console.log(`    ${complexityIcon} Complexity:   ${this.formatCategoryLine(complexity)}`);
    
    // Hygiene
    const hygieneIcon = this.getCategoryIcon(hygiene.impact);
    console.log(`    ${hygieneIcon} Hygiene:      ${this.formatCategoryLine(hygiene)}`);
  }

  private getCategoryIcon(impact: 'HIGH' | 'MEDIUM' | 'LOW'): string {
    if (impact === 'HIGH') return pc.red('🔴');
    if (impact === 'MEDIUM') return pc.yellow('⚠️ ');
    return pc.blue('ℹ️ ');
  }

  private formatCategoryLine(category: import('../core/types.js').CategoryScore): string {
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

    const grouped = groupViolationsByType(result.violations);
    
    this.printModuleStatistics(result);
    
    // Show LOC if available
    if (result.totalLOC) {
      console.log(`  Total Lines of Code:   ${pc.cyan(result.totalLOC.toLocaleString())}`);
    }
    
    this.printArchitectureViolations(grouped);
    this.printGodFileDetails(grouped);
  }

  private printModuleStatistics(result: AnalysisResult): void {
    console.log(`  Files Analyzed:        ${pc.bold(result.totalModules.toString())}`);
    const healthyPercent = Math.round(result.healthyModuleCount / result.totalModules * 100);
    console.log(`  Healthy Modules:       ${pc.green(`${result.healthyModuleCount} / ${result.totalModules}`)} ${pc.dim(`(${healthyPercent}%)`)}`);
    console.log();
  }

  private printArchitectureViolations(grouped: Record<string, Violation[]>): void {
    const circularCount = grouped['Circular Dependency']?.length || 0;
    const layerCount = grouped['Layer Violation']?.length || 0;
    const godFileCount = grouped['God File']?.length || 0;
    const forbiddenCount = grouped['Forbidden Import']?.length || 0;

    console.log(`  Circular Dependencies: ${this.formatCountDisplay(circularCount)}`);
    console.log(`  Layer Violations:      ${this.formatCountDisplay(layerCount)}`);
    console.log(`  God Files:             ${godFileCount > 0 ? this.formatWarningDisplay(godFileCount) + ' ⚠️' : pc.green('0 ✅')}`);
    console.log(`  Forbidden Imports:     ${this.formatWarningDisplay(forbiddenCount)}`);
  }

  private printGodFileDetails(grouped: Record<string, Violation[]>): void {
    const godFileCount = grouped['God File']?.length || 0;
    
    if (godFileCount === 0) return;
    
    const largestFile = this.getLargestFile(grouped['God File'] || []);
    if (largestFile) {
      console.log(`  Largest File:          ${pc.yellow(largestFile)}`);
    }

    const avgSize = this.getAverageFileSize(grouped['God File'] || []);
    if (avgSize) {
      console.log(`  Average File Size:     ${avgSize}`);
    }
  }

  private formatCountDisplay(count: number): string {
    if (count === 0) return pc.green('0 ✅');
    return pc.red(count.toString());
  }

  private formatWarningDisplay(count: number): string {
    if (count === 0) return pc.green('0 ✅');
    return pc.yellow(count.toString());
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
    
    // Sort by severity weight
    const sortedTypes = Object.keys(grouped).sort((a, b) => {
      const aWeight = this.getSeverityWeight(grouped[a][0].severity);
      const bWeight = this.getSeverityWeight(grouped[b][0].severity);
      return bWeight - aWeight;
    });

    for (const type of sortedTypes) {
      this.printGroupedViolationType(type, grouped[type]);
    }
  }

  private printGroupedViolationType(type: string, violations: Violation[]): void {
    const icon = getSeverityIcon(violations[0].severity);
    const color = getSeverityColor(violations[0].severity);
    
    console.log(color(`  ${icon} ${type.toUpperCase()} (${violations.length})`));
    console.log(pc.dim('  ' + '─'.repeat(52)));

    // Use specific summary printer or fallback to generic
    const printer = SUMMARY_PRINTERS[type] || printGenericViolationSummary;
    printer(violations);

    console.log();
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
      this.printViolation(violation, true);
      console.log(pc.dim('─'.repeat(SEPARATOR_WIDTH)));
      console.log();
    }
  }

  private printViolation(violation: Violation, detailed: boolean): void {
    const icon = getSeverityIcon(violation.severity);
    const color = getSeverityColor(violation.severity);

    console.log(color(`${icon} ${violation.rule.toUpperCase()}`));
    // Format as file:line for clickable links in terminal
    const fileLocation = violation.line ? `${violation.file}:${violation.line}` : violation.file;
    console.log(pc.dim(fileLocation));
    
    if (violation.relatedFile) {
      console.log(pc.dim('   ↓ imports'));
      console.log(pc.dim(violation.relatedFile));
    }

    console.log();
    console.log(pc.dim(violation.message));

    if (detailed) {
      console.log();
      console.log(pc.bold('Why this matters:'));
      console.log(wrapText(violation.impact, 50));
      
      console.log();
      console.log(pc.bold('Suggested fix:'));
      console.log(pc.green(wrapText(violation.suggestedFix, 50)));
    }
  }

  // Helper methods

  private getRiskLevel(result: AnalysisResult): string {
    if (result.criticalCount > 0) return 'HIGH';
    if (result.warningCount > 5) return 'MEDIUM';
    if (result.warningCount > 0) return 'LOW';
    return 'MINIMAL';
  }

  private getPrimaryConcern(result: AnalysisResult): string {
    const grouped = groupViolationsByType(result.violations);
    
    const primaryConcern = this.findPrimaryConcernByPriority(grouped);
    if (primaryConcern) return primaryConcern;
    
    return this.getMostCommonConcern(grouped);
  }

  private findPrimaryConcernByPriority(grouped: GroupedViolations): string | null {
    const concernConfigs = this.getConcernConfigurations();
    
    for (const config of concernConfigs) {
      const violations = grouped[config.type];
      if (violations && violations.length > 0) {
        return config.format(violations.length);
      }
    }
    
    return null;
  }

  private getConcernConfigurations(): any[] {
    return [
      {
        type: 'Circular Dependency',
        format: (count: number) => `Circular dependencies — ${count} cycle${count === 1 ? '' : 's'} detected`
      },
      {
        type: 'Layer Violation',
        format: (count: number) => `Architectural boundaries — ${count} layer ${count === 1 ? 'violation' : 'violations'}`
      },
      {
        type: 'Forbidden Import',
        format: (count: number) => `Import restrictions — ${count} forbidden ${count === 1 ? 'import' : 'imports'}`
      },
      {
        type: 'God File',
        format: () => 'File modularity — oversized source and test files'
      },
      {
        type: 'Duplicate Code',
        format: (count: number) => `Code duplication — ${count} duplicate ${count === 1 ? 'block' : 'blocks'} found`
      },
      {
        type: 'High Cyclomatic Complexity',
        format: (count: number) => `Code complexity — ${count} overly complex ${count === 1 ? 'function' : 'functions'}`
      },
      {
        type: 'Large Function',
        format: (count: number) => `Function size — ${count} oversized ${count === 1 ? 'function' : 'functions'}`
      },
      {
        type: 'Dead Code',
        format: (count: number) => `Dead code — ${count} unused ${count === 1 ? 'element' : 'elements'}`
      }
    ];
  }

  private getMostCommonConcern(grouped: GroupedViolations): string {
    const sortedTypes = Object.keys(grouped).sort((a, b) => 
      grouped[b].length - grouped[a].length
    );
    
    if (sortedTypes.length === 0) {
      return 'None';
    }
    
    const primaryType = sortedTypes[0];
    const count = grouped[primaryType].length;
    return `${primaryType} — ${count} ${count === 1 ? 'issue' : 'issues'}`;
  }

  private getLargestFile(violations: Violation[]): string | null {
    if (violations.length === 0) return null;
    
    const largest = violations
      .map(v => ({
        file: v.file,
        lines: parseInt(v.message.match(/(\d+) lines/)?.[1] || '0')
      }))
      .sort((a, b) => b.lines - a.lines)[0];

    const fileName = largest.file.split('/').pop() || largest.file;
    return `${fileName} (${largest.lines} lines)`;
  }

  private getAverageFileSize(violations: Violation[]): string | null {
    if (violations.length === 0) return null;
    
    const sizes = violations.map(v => 
      parseInt(v.message.match(/(\d+) lines/)?.[1] || '0')
    );
    const avg = Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length);
    
    // Visual bar (0-1500 lines scale)
    const maxScale = 1500;
    const filled = Math.min(10, Math.floor((avg / maxScale) * 10));
    const empty = 10 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    
    return `${avg} lines ${pc.dim(bar)}`;
  }

  private getSeverityWeight(severity: string): number {
    switch (severity) {
      case 'critical': return 3;
      case 'warning': return 2;
      case 'info': return 1;
      default: return 0;
    }
  }
}
