import { Reporter } from '@domain/reporter.js';
import { AnalysisResult } from '@domain/types.js';
import {
  serializeViolation,
  serializeViolationBrief,
  serializeResultSummary,
} from '@presentation/utils/violation-utils.js';

/**
 * JSON reporter for CI/CD integration
 */
export class JsonReporter implements Reporter {
  report(result: AnalysisResult, _verbose: boolean): void {
    const output = {
      ...serializeResultSummary(result),
      modulesAnalyzedPercent: result.modulesAnalyzedPercent,
      couplingRisk: result.couplingRisk,
      blastRadius: result.blastRadius,
      topRisks: result.topRisks.map(serializeViolation),
      violations: result.violations.map(serializeViolationBrief),
    };

    console.log(JSON.stringify(output, null, 2));
  }
}
