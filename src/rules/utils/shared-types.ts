import { SourceFile } from 'ts-morph';
import { Violation } from '../../core/types.js';

/**
 * Shared type definitions for rules to reduce duplication
 */

/**
 * Context for file-level checks in rules
 * Used by rules that analyze entire source files
 */
export interface FileCheckContext {
  readonly sourceFile: SourceFile;
  readonly relativePath: string;
  readonly threshold: number;
  readonly violations: Violation[];
}

/**
 * Standard violation data structure
 * Used to create violations in a consistent way
 */
export interface ViolationData {
  readonly name: string;
  readonly count: number;
  readonly threshold: number;
  readonly file: string;
  readonly line: number;
  readonly type: string;
}
