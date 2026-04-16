/**
 * Barrel export for all rules
 *
 * ARCHITECTURE-FOCUSED RULES ONLY
 * Archguard is NOT a linter — use ESLint for code style, complexity, and file metrics.
 *
 * These rules focus on what linters cannot do:
 * - Structural integrity across the project graph (layer violations)
 * - Coupling and cohesion metrics (too many imports)
 * - Cross-function/cross-file design pattern smells (data clumps, shotgun surgery)
 * - Code duplication across module boundaries
 */

// === STRUCTURAL ARCHITECTURE ===
export { LayerViolationRule } from './layer-violation.rule.js';
export { FeatureBoundaryRule } from './feature-boundary.rule.js';

// === COUPLING ANALYSIS ===
export { TooManyImportsRule } from './too-many-imports.rule.js';
export { ShotgunSurgeryRule } from './shotgun-surgery.rule.js';

// === DESIGN SMELLS (cross-file analysis) ===
export { DataClumpsRule } from './data-clumps.rule.js';

// === CODE HEALTH ===
export { DuplicateCodeRule } from './duplicate-code.rule.js';
