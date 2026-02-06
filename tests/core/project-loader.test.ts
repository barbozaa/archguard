import { describe, it, expect } from 'vitest';
import { ProjectLoader } from '@core/project-loader.js';
import type { Config } from '@config/config-schema.js';

describe('ProjectLoader', () => {
  it('should create project loader instance', () => {
    const loader = new ProjectLoader();
    expect(loader).toBeDefined();
  });

  it('should have load method', () => {
    const loader = new ProjectLoader();
    expect(typeof loader.load).toBe('function');
  });

  it('should have getProject method', () => {
    const loader = new ProjectLoader();
    expect(typeof loader.getProject).toBe('function');
  });

  it('should load project with config', async () => {
    const config: Config = {
      srcDirectory: './src',
      rules: { maxFileLines: 500 }
    };
    
    const loader = new ProjectLoader();
    
    const context = await loader.load(config);
    expect(context).toBeDefined();
    expect(context.rootPath).toBeDefined();
  });

  it('should load source files from configured directory', async () => {    
    const config: Config = {
      srcDirectory: './src',
      rules: { maxFileLines: 500 }
    };
    
    const loader = new ProjectLoader();
    const context = await loader.load(config);
    
    // Should have loaded source files
    expect(context.sourceFiles.length).toBeGreaterThan(0);
    
    // Should have module count
    expect(context.moduleCount).toBeGreaterThan(0);
    
    // Module count should match source files length
    expect(context.moduleCount).toBe(context.sourceFiles.length);
  });

  it('should apply ignore patterns from config', async () => {
    const config: Config = {
      srcDirectory: './src',
      rules: { maxFileLines: 500 },
      ignore: ['**/*.generated.ts', '**/build/**']
    };
    
    const loader = new ProjectLoader();
    await loader.load(config);
    const sourceFiles = loader.getProject().getSourceFiles();
    
    // Should have loaded some files
    expect(sourceFiles.length).toBeGreaterThan(0);
    
    // Check that ignored patterns are not included
    const ignoredFiles = sourceFiles.filter(sf => {
      const path = sf.getFilePath();
      return path.includes('.generated.ts') || path.includes('/build/');
    });
    
    expect(ignoredFiles).toHaveLength(0);
  });

  it('should filter out node_modules', async () => {
    const config: Config = {
      srcDirectory: './src',
      rules: { maxFileLines: 500 }
    };
    
    const loader = new ProjectLoader();
    await loader.load(config);
    const sourceFiles = loader.getProject().getSourceFiles();
    
    // Check that no node_modules files are included
    const nodeModulesFiles = sourceFiles.filter(sf => 
      sf.getFilePath().includes('node_modules')
    );
    
    expect(nodeModulesFiles).toHaveLength(0);
  });
});
