import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigLoader } from '../../src/config/config-loader.js';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('ConfigLoader', () => {
  const testDir = '/tmp/archguard-test';
  let loader: ConfigLoader;
  
  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    loader = new ConfigLoader();
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  it('should create config loader instance', () => {
    expect(loader).toBeDefined();
  });

  it('should load config from file', async () => {
    const configPath = join(testDir, 'archguard.config.json');
    const config = {
      root: testDir,
      include: ['**/*.ts'],
      exclude: ['node_modules/**'],
      rules: { maxFileLines: 500, }
    };
    
    writeFileSync(configPath, JSON.stringify(config));
    
    const loaded = await loader.load(configPath);
    expect(loaded).toBeDefined();
  });

  it('should load default config when no file specified', async () => {
    const config = await loader.load();
    expect(config).toBeDefined();
  });
});
