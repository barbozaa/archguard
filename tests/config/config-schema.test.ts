import { describe, it, expect } from 'vitest';
import { ConfigSchema, defaultConfig } from '../../src/config/config-schema.js';
import type { Config } from '../../src/config/config-schema.js';

describe('ConfigSchema', () => {
  it('should validate valid config', () => {
    const validConfig = {
      srcDirectory: './src',
      rules: { maxFileLines: 500,
        maxFileLines: 500
       }
    };
    
    const result = ConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('should accept config with custom rules', () => {
    const config = {
      srcDirectory: './src',
      rules: { maxFileLines: 500,
        maxFileLines: 300
       }
    };
    
    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('should accept config with tsconfig path', () => {
    const config = {
      srcDirectory: './src',
      tsConfigPath: './tsconfig.json',
      rules: { maxFileLines: 500,
        maxFileLines: 500
       }
    };
    
    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('should have default config', () => {
    expect(defaultConfig).toBeDefined();
    expect(defaultConfig.srcDirectory).toBe('./src');
    expect(defaultConfig.rules?.maxFileLines).toBe(500);
  });
});
