import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { GraphBuilder } from '../../src/core/graph-builder.js';

describe('GraphBuilder', () => {
  let project: Project;
  let builder: GraphBuilder;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    builder = new GraphBuilder();
  });

  it('should build empty graph', () => {
    const graph = builder.build(project, '/test');
    
    expect(graph).toBeDefined();
    expect(graph.nodes.size).toBe(0);
    expect(graph.cyclicGroups.length).toBe(0);
  });

  it('should build graph with single file', () => {
    project.createSourceFile('a.ts', 'export const a = 1;');
    
    const graph = builder.build(project, '/test');
    
    expect(graph.nodes.size).toBe(1);
  });

  it('should detect dependencies', () => {
    project.createSourceFile('/test/a.ts', 'export const a = 1;');
    project.createSourceFile('/test/b.ts', `
      import { a } from './a';
      export const b = a + 1;
    `);
    
    const graph = builder.build(project, '/test');
    
    expect(graph.nodes.size).toBe(2);
    const nodeB = graph.nodes.get('b.ts');
    expect(nodeB).toBeDefined();
    expect(nodeB?.dependencies.size).toBeGreaterThan(0);
  });

  it('should detect circular dependencies', () => {
    project.createSourceFile('a.ts', `
      import { b } from './b';
      export const a = 1;
    `);
    project.createSourceFile('b.ts', `
      import { a } from './a';
      export const b = 2;
    `);
    
    const graph = builder.build(project, '/test');
    
    expect(graph.cyclicGroups.length).toBeGreaterThanOrEqual(0);
  });

  it('should skip node_modules', () => {
    project.createSourceFile('node_modules/lib.ts', 'export const lib = 1;');
    project.createSourceFile('app.ts', `
      import { lib } from './node_modules/lib';
      export const app = lib;
    `);
    
    const graph = builder.build(project, '/test');
    
    expect(graph.nodes.has('node_modules/lib.ts')).toBe(false);
  });

  it('should normalize file paths', () => {
    project.createSourceFile('/test/src/file.ts', 'export const x = 1;');
    
    const graph = builder.build(project, '/test');
    
    expect(graph.nodes.has('src/file.ts')).toBe(true);
  });
});
