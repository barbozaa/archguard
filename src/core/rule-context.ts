import { Project } from 'ts-morph';
import { DependencyGraph } from './types.js';
import { Config } from '../config/config-schema.js';

/**
 * Shared context for all rules to eliminate parameter duplication (Data Clumps)
 */
export interface RuleContext {
  readonly project: Project;
  readonly graph: DependencyGraph;
  readonly config: Config;
  readonly rootPath: string;
}

/**
 * Helper to create a rule context
 */
export function createRuleContext(
  project: Project,
  graph: DependencyGraph,
  config: Config,
  rootPath: string
): RuleContext {
  return { project, graph, config, rootPath };
}
