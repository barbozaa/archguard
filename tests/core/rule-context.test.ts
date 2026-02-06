import { describe, it, expect } from 'vitest';
import { createRuleContext } from '@core/rule-context.js';
import { Project } from 'ts-morph';
import type { DependencyGraph } from '@core/types.js';

describe('RuleContext', () => {
  it('should create rule context', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const graph: DependencyGraph = {
      nodes: new Map(),
      cyclicGroups: []
    };
    const config = { srcDirectory: './src', rules: { maxFileLines: 500 } };
    
    const context = createRuleContext(project, graph, config, '/test');
    
    expect(context).toBeDefined();
    expect(context.project).toBe(project);
    expect(context.rootPath).toBe('/test');
    expect(context.graph).toBe(graph);
  });

  it('should provide config', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const graph: DependencyGraph = {
      nodes: new Map(),
      cyclicGroups: []
    };
    const config = { 
      srcDirectory: './src', 
      rules: { 
        maxFileLines: 500,
        layerRules: { 'core': ['config', 'utils'] }
      } 
    };
    
    const context = createRuleContext(project, graph, config, '/test');
    
    expect(context.config).toBeDefined();
    expect(context.config.rules?.layerRules).toBeDefined();
  });

  it('should have config with rules', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const graph: DependencyGraph = {
      nodes: new Map(),
      cyclicGroups: []
    };
    const config = { srcDirectory: './src', rules: { maxFileLines: 500 } };
    
    const context = createRuleContext(project, graph, config, '/test');
    
    expect(context.config).toBeDefined();
    expect(context.config.rules).toBeDefined();
  });
});
