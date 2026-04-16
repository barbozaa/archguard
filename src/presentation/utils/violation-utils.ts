import { AnalysisResult, Violation } from '@domain/types.js';

/**
 * Groups violations by their rule type
 */
export function groupViolationsByType(violations: Violation[]): Record<string, Violation[]> {
  const grouped: Record<string, Violation[]> = {};
  for (const violation of violations) {
    if (!grouped[violation.rule]) {
      grouped[violation.rule] = [];
    }
    grouped[violation.rule].push(violation);
  }
  return grouped;
}

/**
 * Serialize a violation to a plain object (for JSON/MCP output)
 */
export function serializeViolation(v: Violation) {
  return {
    rule: v.rule,
    severity: v.severity,
    file: v.file,
    relatedFile: v.relatedFile,
    line: v.line,
    message: v.message,
    impact: v.impact,
    suggestedFix: v.suggestedFix,
    penalty: v.penalty,
  };
}

/**
 * Serialize a violation with minimal fields (no penalty/impact/fix)
 */
export function serializeViolationBrief(v: Violation) {
  return {
    rule: v.rule,
    severity: v.severity,
    file: v.file,
    relatedFile: v.relatedFile,
    line: v.line,
    message: v.message,
  };
}

/**
 * Serialize an AnalysisResult into a summary object suitable for JSON/MCP output.
 */
export function serializeResultSummary(result: AnalysisResult) {
  return {
    score: result.score,
    architectureScore: result.architectureScore,
    hygieneScore: result.hygieneScore,
    status: result.status,
    confidenceLevel: result.confidenceLevel,
    projectName: result.projectName,
    timestamp: result.timestamp,
    summary: {
      critical: result.criticalCount,
      warnings: result.warningCount,
      info: result.infoCount,
      healthyModules: result.healthyModuleCount,
      totalModules: result.totalModules,
      totalLOC: result.totalLOC,
    },
    scoreBreakdown: result.scoreBreakdown,
  };
}

