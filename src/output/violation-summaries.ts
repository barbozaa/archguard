/**
 * Violation summary printers
 * Re-exports all summary functions from categorized modules
 */

// Structure-related violations (architecture, modularity)
export {
  printGodFileSummary,
  printCircularDepSummary,
  printLayerViolationSummary,
  printForbiddenImportSummary
} from './summaries/structure-violations.js';

// Quality-related violations (testing, dead code, types)
export {
  printMissingTestsSummary,
  printSkippedTestsSummary,
  printMissingTypeAnnotationsSummary,
  printUnusedExportsSummary
} from './summaries/quality-violations.js';

// Complexity-related violations (function/method complexity)
export {
  printCyclomaticComplexitySummary,
  printDeepNestingSummary,
  printLargeFunctionSummary,
  printLongParameterListSummary,
  printTooManyImportsSummary
} from './summaries/complexity-violations.js';

// Code smell violations (OOP anti-patterns, duplication)
export {
  printFeatureEnvySummary,
  printDataClumpsSummary,
  printShotgunSurgerySummary,
  printDuplicateCodeSummary
} from './summaries/code-smell-violations.js';

// Style-related violations (formatting, conventions)
export {
  printMagicNumbersSummary,
  printWildcardImportsSummary,
  printTodoCommentsSummary,
  printGenericViolationSummary
} from './summaries/style-violations.js';

