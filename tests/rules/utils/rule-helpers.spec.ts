import { describe, it, expect } from 'vitest';
import { 
  getThresholdFromConfig, 
  isTestFile, 
  shouldSkipNodeModules 
} from '@rules/utils/rule-helpers.js';

describe('rule-helpers', () => {
  describe('getThresholdFromConfig', () => {
    it('should return threshold from config when key exists', () => {
      const config = { maxLines: 100 };
      expect(getThresholdFromConfig(config, 'maxLines')).toBe(100);
    });

    it('should return threshold from default "threshold" key', () => {
      const config = { threshold: 50 };
      expect(getThresholdFromConfig(config)).toBe(50);
    });

    it('should return undefined when config is undefined', () => {
      expect(getThresholdFromConfig(undefined, 'maxLines')).toBeUndefined();
    });

    it('should return undefined when config is not an object', () => {
      expect(getThresholdFromConfig(true, 'maxLines')).toBeUndefined();
    });

    it('should return undefined when key does not exist', () => {
      const config = { otherKey: 100 };
      expect(getThresholdFromConfig(config, 'maxLines')).toBeUndefined();
    });

    it('should return undefined for non-numeric values', () => {
      const config = { maxLines: 'invalid' };
      expect(getThresholdFromConfig(config, 'maxLines')).toBeUndefined();
    });
  });

  describe('isTestFile', () => {
    it('should return true for .spec.ts files', () => {
      expect(isTestFile('/project/file.spec.ts')).toBe(true);
    });

    it('should return true for .test.ts files', () => {
      expect(isTestFile('/project/file.test.ts')).toBe(true);
    });

    it('should return true for .spec.js files', () => {
      expect(isTestFile('/project/file.spec.js')).toBe(true);
    });

    it('should return true for .test.js files', () => {
      expect(isTestFile('/project/file.test.js')).toBe(true);
    });

    it('should return false for regular files', () => {
      expect(isTestFile('/project/file.ts')).toBe(false);
    });
  });

  describe('shouldSkipNodeModules', () => {
    it('should return true for node_modules files', () => {
      expect(shouldSkipNodeModules('/project/node_modules/package/file.ts')).toBe(true);
    });

    it('should return false for regular files', () => {
      expect(shouldSkipNodeModules('/project/src/file.ts')).toBe(false);
    });
  });
});
