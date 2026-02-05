/**
 * Utility functions for calculating severity levels and penalties
 * Shared across multiple rules to eliminate code duplication
 */

export type SeverityLevel = 'info' | 'warning' | 'critical';

/**
 * Configuration for severity thresholds
 */
export interface SeverityThresholds {
  readonly critical: number;
  readonly warning: number;
}

/**
 * Configuration for penalty calculation
 */
export interface PenaltyConfig {
  readonly criticalBase: number;
  readonly criticalMultiplier: number;
  readonly warningBase: number;
  readonly warningMultiplier: number;
  readonly infoBase: number;
  readonly infoMultiplier?: number;
}

/**
 * Calculate severity level based on a metric value and thresholds
 * 
 * @param value The metric value to evaluate
 * @param thresholds The threshold configuration
 * @returns The calculated severity level
 */
export function calculateSeverity(value: number, thresholds: SeverityThresholds): SeverityLevel {
  if (value > thresholds.critical) return 'critical';
  if (value > thresholds.warning) return 'warning';
  return 'info';
}

/**
 * Calculate penalty score based on metric value, threshold, and configuration
 * 
 * @param value The metric value
 * @param threshold The base threshold
 * @param thresholds Severity thresholds
 * @param config Penalty configuration
 * @returns The calculated penalty score
 */
export function calculatePenalty(
  value: number,
  threshold: number,
  thresholds: SeverityThresholds,
  config: PenaltyConfig
): number {
  const excess = value - threshold;
  
  if (value > thresholds.critical) {
    return config.criticalBase + (excess * config.criticalMultiplier);
  } else if (value > thresholds.warning) {
    return config.warningBase + (excess * config.warningMultiplier);
  } else {
    const multiplier = config.infoMultiplier ?? 1;
    return config.infoBase + (excess * multiplier);
  }
}
