/**
 * Violation summary printers — one per active rule
 */

export { printLayerViolationSummary, printFeatureBoundarySummary } from './structure-violations.js';

export { printTooManyImportsSummary } from './complexity-violations.js';

export {
  printDataClumpsSummary,
  printShotgunSurgerySummary,
  printDuplicateCodeSummary,
} from './code-smell-violations.js';

export { printGenericViolationSummary } from './summary-helpers.js';
