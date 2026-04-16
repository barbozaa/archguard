import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { Config, ConfigSchema, defaultConfig } from './config-schema.js';

/**
 * Loads and validates configuration
 */
export class ConfigLoader {
  async load(configPath?: string): Promise<Config> {
    if (configPath) {
      return this.loadFromPath(configPath);
    }

    return this.loadFromDefaultPaths();
  }

  private async loadFromPath(configPath: string): Promise<Config> {
    try {
      const fullPath = resolve(process.cwd(), configPath);
      const content = await readFile(fullPath, 'utf-8');
      return this.validate(JSON.parse(content));
    } catch (error) {
      throw new Error(`Failed to load config from ${configPath}: ${error}`);
    }
  }

  private async loadFromDefaultPaths(): Promise<Config> {
    const defaultPaths = [
      './archguard.config.json',
      './.archguard.json',
    ];

    for (const path of defaultPaths) {
      const config = await this.tryLoadFromPath(path);
      if (config) return config;
    }

    // No config found, use defaults
    return defaultConfig;
  }

  private async tryLoadFromPath(path: string): Promise<Config | null> {
    try {
      const fullPath = resolve(process.cwd(), path);
      const content = await readFile(fullPath, 'utf-8');
      return this.validate(JSON.parse(content));
    } catch {
      return null;
    }
  }

  private validate(data: unknown): Config {
    try {
      return ConfigSchema.parse(data);
    } catch (error) {
      throw new Error(`Invalid configuration: ${error}`);
    }
  }
}
