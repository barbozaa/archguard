import { AnalysisResult } from '@domain/types.js';

export interface Reporter {
  report(result: AnalysisResult, verbose: boolean): void;
}
