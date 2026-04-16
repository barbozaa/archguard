import { resolve } from 'path';
import { Analyzer } from './analyzer.js';
import { ConfigLoader } from '@infrastructure/config/config-loader.js';
import { AnalysisResult } from '@domain/types.js';

/**
 * Runs a full architecture analysis on the given directory.
 * Changes cwd temporarily and restores it afterwards.
 */
export async function analyzeProject(
  projectPath: string,
  configPath?: string,
): Promise<AnalysisResult> {
  const original = process.cwd();
  try {
    process.chdir(resolve(projectPath));
    const config = await new ConfigLoader().load(configPath);
    return new Analyzer().analyze(config);
  } finally {
    process.chdir(original);
  }
}
