import { Violation } from '@core/types.js';
import { RuleContext } from '@core/rule-context.js';

/**
 * Rule interface that all rules must implement
 */
export interface Rule {
  name: string;
  severity: 'info' | 'warning' | 'critical';
  penalty: number;
  check(context: RuleContext): Violation[];
}
