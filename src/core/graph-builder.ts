import { Project, SourceFile } from 'ts-morph';
import { relative, dirname, resolve } from 'path';
import { DependencyGraph, DependencyNode } from './types.js';

/**
 * Builds dependency graph from TypeScript project
 */
export class GraphBuilder {
  build(project: Project, rootPath: string): DependencyGraph {
    const nodes = new Map<string, DependencyNode>();
    const sourceFiles = project.getSourceFiles();

    // Build nodes
    for (const sourceFile of sourceFiles) {
      if (sourceFile.getFilePath().includes('node_modules')) {
        continue;
      }

      const filePath = this.normalizeFilePath(sourceFile, rootPath);
      const dependencies = this.extractDependencies(sourceFile, rootPath);

      nodes.set(filePath, {
        file: filePath,
        dependencies,
        dependents: new Set(),
      });
    }

    // Build reverse dependencies
    for (const [file, node] of nodes.entries()) {
      for (const dep of node.dependencies) {
        const depNode = nodes.get(dep);
        if (depNode) {
          depNode.dependents.add(file);
        }
      }
    }

    // Detect cycles
    const cyclicGroups = this.detectCycles(nodes);

    return {
      nodes,
      cyclicGroups,
    };
  }

  private normalizeFilePath(sourceFile: SourceFile, rootPath: string): string {
    return relative(rootPath, sourceFile.getFilePath());
  }

  private extractDependencies(
    sourceFile: SourceFile,
    rootPath: string
  ): Set<string> {
    const dependencies = new Set<string>();
    const importDeclarations = sourceFile.getImportDeclarations();

    for (const importDecl of importDeclarations) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      
      // Skip external modules
      if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) {
        continue;
      }

      // Resolve the import
      const sourceFilePath = sourceFile.getFilePath();
      const sourceFileDir = dirname(sourceFilePath);
      
      try {
        const resolvedPath = this.resolveImport(
          moduleSpecifier,
          sourceFileDir,
          rootPath
        );
        
        if (resolvedPath) {
          dependencies.add(resolvedPath);
        }
      } catch {
        // Skip unresolvable imports
      }
    }

    return dependencies;
  }

  private resolveImport(
    moduleSpecifier: string,
    fromDir: string,
    rootPath: string
  ): string | null {
    // Simple resolution - in production, use enhanced-resolve
    let resolved = resolve(fromDir, moduleSpecifier);

    // Try adding extensions
    const extensions = ['.ts', '.tsx', '.js', '/index.ts', '/index.tsx'];
    
    for (const ext of extensions) {
      try {
        const candidate = resolved + ext;
        return relative(rootPath, candidate);
      } catch {
        continue;
      }
    }

    return relative(rootPath, resolved);
  }

  private detectCycles(nodes: Map<string, DependencyNode>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const currentPath: string[] = [];

    const dfs = (file: string): void => {
      visited.add(file);
      recursionStack.add(file);
      currentPath.push(file);

      const node = nodes.get(file);
      if (!node) {
        currentPath.pop();
        recursionStack.delete(file);
        return;
      }

      for (const dep of node.dependencies) {
        if (!visited.has(dep)) {
          dfs(dep);
        } else if (recursionStack.has(dep)) {
          // Found a cycle
          const cycleStart = currentPath.indexOf(dep);
          const cycle = currentPath.slice(cycleStart);
          cycles.push([...cycle, dep]);
        }
      }

      currentPath.pop();
      recursionStack.delete(file);
    };

    for (const file of nodes.keys()) {
      if (!visited.has(file)) {
        dfs(file);
      }
    }

    return cycles;
  }
}
