/**
 * Barrel export for all rules
 * 
 * ARCHITECTURE-FOCUSED RULES ONLY
 * Archguard is NOT a linter - use ESLint for code style
 * 
 * These rules focus on:
 * - Structural integrity (circular deps, layer violations)
 * - Architectural boundaries (forbidden imports)
 * - Coupling and cohesion metrics
 * - Design pattern adherence
 */

// === CORE ARCHITECTURE RULES (Critical) ===
export { CircularDepsRule } from './circular-deps.rule.js';
export { LayerViolationRule } from './layer-violation.rule.js';
export { ForbiddenImportsRule } from './forbidden-imports.rule.js';

// === COUPLING & COMPLEXITY ANALYSIS ===
export { TooManyImportsRule } from './too-many-imports.rule.js';
export { CyclomaticComplexityRule } from './cyclomatic-complexity.rule.js';
export { DeepNestingRule } from './deep-nesting.rule.js';
export { LargeFunctionRule } from './large-function.rule.js';
export { MaxFileLinesRule } from './max-file-lines.rule.js';

// === DESIGN PATTERN & API QUALITY ===
export { LongParameterListRule } from './long-parameter-list.rule.js';
export { DataClumpsRule } from './data-clumps.rule.js';
export { ShotgunSurgeryRule } from './shotgun-surgery.rule.js';

// === CODE HEALTH ===
export { DuplicateCodeRule } from './duplicate-code.rule.js';
export { UnusedExportsRule } from './unused-exports.rule.js';
export { DeadCodeRule } from './dead-code.rule.js';
