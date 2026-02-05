import { AnalysisResult } from '../core/types.js';

/**
 * Reporter interface that all output formatters must implement
 */
export interface Reporter {
  report(result: AnalysisResult, verbose: boolean): void;
}
