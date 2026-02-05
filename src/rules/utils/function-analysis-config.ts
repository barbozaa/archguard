/**
 * Shared configuration utilities for function analysis rules
 * Reduces duplication across cyclomatic-complexity, deep-nesting, and large-function rules
 */

import { SeverityThresholds, PenaltyConfig } from './severity-calculator.js';

/**
 * Standard penalty configuration for high complexity/nesting/size
 */
export const STANDARD_PENALTY_CONFIG: PenaltyConfig = {
  criticalBase: 15,
  criticalMultiplier: 2,
  warningBase: 10,
  warningMultiplier: 1.5,
  infoBase: 5
};

/**
 * Shared impact message for complexity-related issues
 */
export const COMPLEXITY_IMPACT = 'High complexity increases bug probability and makes code harder to understand and test';

/**
 * Shared impact message for nesting-related issues
 */
export const NESTING_IMPACT = 'Increases complexity and bug risk, makes code harder to understand and test';

/**
 * Create severity thresholds configuration
 */
export function createSeverityThresholds(critical: number, warning: number): SeverityThresholds {
  return { critical, warning };
}
