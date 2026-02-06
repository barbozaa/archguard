import { Reporter } from './reporter-interface.js';
import { AnalysisResult } from '@core/types.js';

/**
 * JSON reporter for CI/CD integration
 */
export class JsonReporter implements Reporter {
  report(result: AnalysisResult, _verbose: boolean): void {
    const output = {
      score: result.score,
      architectureScore: result.architectureScore,
      hygieneScore: result.hygieneScore,
      status: result.status,
      confidenceLevel: result.confidenceLevel,
      modulesAnalyzedPercent: result.modulesAnalyzedPercent,
      timestamp: result.timestamp,
      projectName: result.projectName,
      summary: {
        critical: result.criticalCount,
        warnings: result.warningCount,
        info: result.infoCount,
        healthyModules: result.healthyModuleCount,
        totalModules: result.totalModules,
        totalLOC: result.totalLOC,
      },
      scoreBreakdown: result.scoreBreakdown,
      couplingRisk: result.couplingRisk,
      blastRadius: result.blastRadius,
      topRisks: result.topRisks.map(v => ({
        rule: v.rule,
        severity: v.severity,
        file: v.file,
        relatedFile: v.relatedFile,
        line: v.line,
        message: v.message,
        impact: v.impact,
        suggestedFix: v.suggestedFix,
      })),
      violations: result.violations.map(v => ({
        rule: v.rule,
        severity: v.severity,
        file: v.file,
        relatedFile: v.relatedFile,
        line: v.line,
        message: v.message,
      })),
    };

    console.log(JSON.stringify(output, null, 2));
  }
}
