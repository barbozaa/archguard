import { Violation } from '@domain/types.js';
import { RuleContext } from '@application/rule-context.js';

export interface Rule {
  name: string;
  severity: 'info' | 'warning' | 'critical';
  penalty: number;
  check(context: RuleContext): Violation[];
}
