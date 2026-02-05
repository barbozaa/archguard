import { describe, it, expect } from 'vitest';
import {
  generateCircularDependencyActions,
  generateLayerViolationActions,
  generateGodFileActions,
  generateTooManyImportsActions,
  generateLargeFunctionActions,
  generateDeepNestingActions,
  generateBulkActions
} from '../../src/output/action-generators.js';
import type { Violation } from '../../src/core/types.js';

describe('Action Generators', () => {
  it('should generate circular dependency actions', () => {
    const violations: Violation[] = [
      {
        message: 'Circular dependency detected',
        file: 'a.ts',
        line: 1,
        severity: 'critical',
        rule: 'circular-deps',
        impact: 'High',
        suggestedFix: 'Break cycle',
        penalty: 30
      }
    ];

    const actions = generateCircularDependencyActions(violations);
    expect(actions).toBeDefined();
    expect(Array.isArray(actions)).toBe(true);
    expect(actions.length).toBeGreaterThan(0);
  });

  it('should generate layer violation actions', () => {
    const violations: Violation[] = [
      {
        message: 'UI depends on data layer',
        file: 'ui.ts',
        line: 5,
        severity: 'critical',
        rule: 'layer-violation',
        impact: 'Architecture',
        suggestedFix: 'Use proper layers',
        penalty: 25
      }
    ];

    const actions = generateLayerViolationActions(violations);
    expect(actions).toBeDefined();
    expect(actions.length).toBeGreaterThan(0);
  });

  it('should generate god file actions', () => {
    const violations: Violation[] = [
      {
        message: 'File too large',
        file: 'large.ts',
        line: 1,
        severity: 'critical',
        rule: 'max-file-lines',
        impact: 'Maintainability',
        suggestedFix: 'Split file',
        penalty: 20
      }
    ];

    const actions = generateGodFileActions(violations);
    expect(actions).toBeDefined();
    expect(actions.length).toBeGreaterThan(0);
  });

  it('should generate too many imports actions', () => {
    const violations: Violation[] = [
      {
        message: 'Too many imports',
        file: 'test.ts',
        line: 1,
        severity: 'warning',
        rule: 'too-many-imports',
        impact: 'Complexity',
        suggestedFix: 'Reduce imports',
        penalty: 10
      }
    ];

    const actions = generateTooManyImportsActions(violations);
    expect(actions).toBeDefined();
    expect(actions.length).toBeGreaterThan(0);
  });

  it('should generate large function actions', () => {
    const violations: Violation[] = [
      {
        message: 'Function too large',
        file: 'test.ts',
        line: 10,
        severity: 'warning',
        rule: 'large-function',
        impact: 'Readability',
        suggestedFix: 'Extract functions',
        penalty: 12
      }
    ];

    const actions = generateLargeFunctionActions(violations);
    expect(actions).toBeDefined();
    expect(actions.length).toBeGreaterThan(0);
  });

  it('should generate deep nesting actions', () => {
    const violations: Violation[] = [
      {
        message: 'Nesting too deep',
        file: 'test.ts',
        line: 20,
        severity: 'warning',
        rule: 'deep-nesting',
        impact: 'Complexity',
        suggestedFix: 'Reduce nesting',
        penalty: 8
      }
    ];

    const actions = generateDeepNestingActions(violations);
    expect(actions).toBeDefined();
    expect(actions.length).toBeGreaterThan(0);
  });

  it('should generate deep nesting actions with HIGH priority for depth > 10', () => {
    const violations: Violation[] = [
      {
        message: "Function 'myFunction' has nesting depth of 12 levels",
        file: 'src/complex.ts',
        line: 20,
        severity: 'critical',
        rule: 'deep-nesting',
        impact: 'Complexity',
        suggestedFix: 'Reduce nesting',
        penalty: 15
      }
    ];

    const actions = generateDeepNestingActions(violations);
    expect(actions).toBeDefined();
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0].priority).toBe('HIGH');
    expect(actions[0].effort).toBe('3-5h');
  });

  it('should generate deep nesting actions with MEDIUM priority for depth 6-10', () => {
    const violations: Violation[] = [
      {
        message: "Function 'anotherFunction' has nesting depth of 8 levels",
        file: 'src/nested.ts',
        line: 15,
        severity: 'warning',
        rule: 'deep-nesting',
        impact: 'Complexity',
        suggestedFix: 'Reduce nesting',
        penalty: 10
      }
    ];

    const actions = generateDeepNestingActions(violations);
    expect(actions).toBeDefined();
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0].priority).toBe('MEDIUM');
    expect(actions[0].effort).toBe('2-3h');
  });

  it('should generate deep nesting actions with LOW priority for depth <= 6', () => {
    const violations: Violation[] = [
      {
        message: "Function 'simpleFunction' has nesting depth of 5 levels",
        file: 'src/simple.ts',
        line: 10,
        severity: 'info',
        rule: 'deep-nesting',
        impact: 'Complexity',
        suggestedFix: 'Reduce nesting',
        penalty: 5
      }
    ];

    const actions = generateDeepNestingActions(violations);
    expect(actions).toBeDefined();
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0].priority).toBe('LOW');
    expect(actions[0].effort).toBe('1-2h');
  });

  it('should generate bulk actions', () => {
    const violations: Violation[] = [
      {
        message: 'No test file',
        file: 'test1.ts',
        line: 1,
        severity: 'warning',
        rule: 'missing-tests',
        impact: 'Coverage',
        suggestedFix: 'Add tests',
        penalty: 10
      },
      {
        message: 'No test file',
        file: 'test2.ts',
        line: 1,
        severity: 'warning',
        rule: 'missing-tests',
        impact: 'Coverage',
        suggestedFix: 'Add tests',
        penalty: 10
      }
    ];

    const actions = generateBulkActions(violations, 'Missing Test File');
    expect(actions).toBeDefined();
    expect(actions.length).toBeGreaterThan(0);
  });

  it('should handle empty violations', () => {
    expect(generateCircularDependencyActions([]).length).toBe(0);
    expect(generateLayerViolationActions([]).length).toBe(0);
    expect(generateGodFileActions([]).length).toBe(0);
    expect(generateTooManyImportsActions([]).length).toBe(0);
    expect(generateLargeFunctionActions([]).length).toBe(0);
    expect(generateDeepNestingActions([]).length).toBe(0);
    expect(generateBulkActions([], 'Test').length).toBe(0);
  });

  it('should generate magic number actions', () => {
    const violations: Violation[] = [
      {
        message: 'Magic Number 42 used',
        file: 'calc.ts',
        line: 5,
        severity: 'info',
        rule: 'magic-numbers',
        impact: 'Clarity',
        suggestedFix: 'Extract to constant',
        penalty: 3
      },
      {
        message: 'Magic Number 100 used',
        file: 'calc.ts',
        line: 10,
        severity: 'info',
        rule: 'magic-numbers',
        impact: 'Clarity',
        suggestedFix: 'Extract to constant',
        penalty: 3
      }
    ];

    const actions = generateBulkActions(violations, 'Magic Number');
    expect(actions).toBeDefined();
    expect(actions.length).toBeGreaterThan(0);
  });

  it('should generate missing type annotation actions', () => {
    const violations: Violation[] = [
      {
        message: 'Parameter lacks type',
        file: 'utils.ts',
        line: 3,
        severity: 'warning',
        rule: 'missing-type-annotations',
        impact: 'Type safety',
        suggestedFix: 'Add type annotation',
        penalty: 5
      }
    ];

    const actions = generateBulkActions(violations, 'Missing Type Annotation');
    expect(actions).toBeDefined();
    expect(actions.length).toBeGreaterThan(0);
  });
});
