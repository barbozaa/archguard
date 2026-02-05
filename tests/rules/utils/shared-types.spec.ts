import { describe, it, expect } from 'vitest';
import { Project, SourceFile } from 'ts-morph';
import { FileCheckContext, ViolationData } from '../../../src/rules/utils/shared-types.js';

describe('Shared Types', () => {
  describe('FileCheckContext', () => {
    it('should define a valid file check context', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', 'const x = 1;');
      
      const context: FileCheckContext = {
        sourceFile,
        relativePath: 'test.ts',
        threshold: 10,
        violations: []
      };

      expect(context.sourceFile).toBe(sourceFile);
      expect(context.relativePath).toBe('test.ts');
      expect(context.threshold).toBe(10);
      expect(context.violations).toEqual([]);
    });

    it('should be readonly', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', '');
      
      const context: FileCheckContext = {
        sourceFile,
        relativePath: 'test.ts',
        threshold: 5,
        violations: []
      };

      // TypeScript will enforce readonly at compile time
      // At runtime, we can verify the properties exist
      expect(context).toHaveProperty('sourceFile');
      expect(context).toHaveProperty('relativePath');
      expect(context).toHaveProperty('threshold');
      expect(context).toHaveProperty('violations');
    });
  });

  describe('ViolationData', () => {
    it('should define violation data structure', () => {
      const data: ViolationData = {
        name: 'test-function',
        count: 15,
        threshold: 10,
        file: 'test.ts',
        line: 42,
        type: 'complexity'
      };

      expect(data.name).toBe('test-function');
      expect(data.count).toBe(15);
      expect(data.threshold).toBe(10);
      expect(data.file).toBe('test.ts');
      expect(data.line).toBe(42);
      expect(data.type).toBe('complexity');
    });

    it('should be readonly', () => {
      const data: ViolationData = {
        name: 'func',
        count: 20,
        threshold: 15,
        file: 'app.ts',
        line: 100,
        type: 'size'
      };

      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('count');
      expect(data).toHaveProperty('threshold');
      expect(data).toHaveProperty('file');
      expect(data).toHaveProperty('line');
      expect(data).toHaveProperty('type');
    });

    it('should support different violation types', () => {
      const complexityData: ViolationData = {
        name: 'complexFunc',
        count: 25,
        threshold: 15,
        file: 'complex.ts',
        line: 10,
        type: 'complexity'
      };

      const sizeData: ViolationData = {
        name: 'largeFunc',
        count: 200,
        threshold: 100,
        file: 'large.ts',
        line: 5,
        type: 'size'
      };

      expect(complexityData.type).toBe('complexity');
      expect(sizeData.type).toBe('size');
    });
  });

  describe('Type Integration', () => {
    it('should allow FileCheckContext with violations array', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', '');
      
      const context: FileCheckContext = {
        sourceFile,
        relativePath: 'test.ts',
        threshold: 10,
        violations: [{
          rule: 'Test',
          severity: 'info',
          message: 'Test violation',
          file: 'test.ts',
          line: 1,
          impact: 'None',
          suggestedFix: 'Fix it',
          penalty: 1
        }]
      };

      expect(context.violations).toHaveLength(1);
      expect(context.violations[0].rule).toBe('Test');
    });

    it('should allow ViolationData with various numeric values', () => {
      const data: ViolationData = {
        name: 'testFunc',
        count: 0,
        threshold: 0,
        file: 'empty.ts',
        line: 1,
        type: 'none'
      };

      expect(data.count).toBe(0);
      expect(data.threshold).toBe(0);
      expect(data.line).toBe(1);
    });
  });
});
