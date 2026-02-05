import { describe, it, expect } from 'vitest';
import { Rule } from '../../src/rules/rule-interface.js';
import { Violation } from '../../src/core/types.js';
import { RuleContext } from '../../src/core/rule-context.js';
import { Project } from 'ts-morph';

describe('Rule Interface', () => {
  it('should be implementable with all required properties', () => {
    class TestRule implements Rule {
      name = 'test-rule';
      severity: 'info' | 'warning' | 'critical' = 'info';
      penalty = 5;

      check(_context: RuleContext): Violation[] {
        return [];
      }
    }

    const rule = new TestRule();
    expect(rule.name).toBe('test-rule');
    expect(rule.severity).toBe('info');
    expect(rule.penalty).toBe(5);
    expect(typeof rule.check).toBe('function');
  });

  it('should support different severity levels', () => {
    class InfoRule implements Rule {
      name = 'info-rule';
      severity: 'info' | 'warning' | 'critical' = 'info';
      penalty = 1;
      check(): Violation[] { return []; }
    }

    class WarningRule implements Rule {
      name = 'warning-rule';
      severity: 'info' | 'warning' | 'critical' = 'warning';
      penalty = 5;
      check(): Violation[] { return []; }
    }

    class CriticalRule implements Rule {
      name = 'critical-rule';
      severity: 'info' | 'warning' | 'critical' = 'critical';
      penalty = 10;
      check(): Violation[] { return []; }
    }

    expect(new InfoRule().severity).toBe('info');
    expect(new WarningRule().severity).toBe('warning');
    expect(new CriticalRule().severity).toBe('critical');
  });

  it('should accept RuleContext and return violations', () => {
    class MockRule implements Rule {
      name = 'mock-rule';
      severity: 'info' | 'warning' | 'critical' = 'warning';
      penalty = 3;

      check(context: RuleContext): Violation[] {
        return [{
          rule: this.name,
          severity: this.severity,
          message: 'Test violation',
          file: 'test.ts',
          line: 1,
          impact: 'Test impact',
          suggestedFix: 'Test fix',
          penalty: this.penalty
        }];
      }
    }

    const rule = new MockRule();
    const project = new Project({ useInMemoryFileSystem: true });
    
    const context: RuleContext = {
      project,
      graph: { nodes: new Map(), cyclicGroups: [] },
      config: { srcDirectory: '/test' },
      rootPath: '/test'
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe('mock-rule');
    expect(violations[0].severity).toBe('warning');
  });

  it('should allow different penalty values', () => {
    class LightRule implements Rule {
      name = 'light';
      severity: 'info' | 'warning' | 'critical' = 'info';
      penalty = 1;
      check(): Violation[] { return []; }
    }

    class HeavyRule implements Rule {
      name = 'heavy';
      severity: 'info' | 'warning' | 'critical' = 'critical';
      penalty = 20;
      check(): Violation[] { return []; }
    }

    expect(new LightRule().penalty).toBe(1);
    expect(new HeavyRule().penalty).toBe(20);
  });

  it('should support empty violation arrays', () => {
    class NoViolationsRule implements Rule {
      name = 'no-violations';
      severity: 'info' | 'warning' | 'critical' = 'info';
      penalty = 0;

      check(_context: RuleContext): Violation[] {
        return [];
      }
    }

    const rule = new NoViolationsRule();
    const project = new Project({ useInMemoryFileSystem: true });
    
    const context: RuleContext = {
      project,
      graph: { nodes: new Map(), cyclicGroups: [] },
      config: { srcDirectory: '/test' },
      rootPath: '/test'
    };

    const violations = rule.check(context);
    expect(violations).toHaveLength(0);
  });
});
