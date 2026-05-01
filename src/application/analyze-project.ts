import { resolve } from 'path';
import { Analyzer } from './analyzer.js';
import { ConfigLoader } from '@infrastructure/config/config-loader.js';
import { AnalysisResult, DependencyGraph } from '@domain/types.js';

/**
 * Runs a full architecture analysis on the given directory.
 * Changes cwd temporarily and restores it afterwards.
 */
export async function analyzeProject(
  projectPath: string,
  configPath?: string,
): Promise<AnalysisResult> {
  const { result } = await analyzeProjectWithGraph(projectPath, configPath);
  return result;
}

/**
 * Same as {@link analyzeProject} but returns the dependency graph for graph-native MCP tools.
 */
export async function analyzeProjectWithGraph(
  projectPath: string,
  configPath?: string,
): Promise<{ result: AnalysisResult; graph: DependencyGraph }> {
  const original = process.cwd();
  try {
    process.chdir(resolve(projectPath));
    const config = await new ConfigLoader().load(configPath);
    return new Analyzer().analyzeWithGraph(config);
  } finally {
    process.chdir(original);
  }
}
