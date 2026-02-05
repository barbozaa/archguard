#!/usr/bin/env node

// src/cli/cli.ts
import cac from "cac";
import pc10 from "picocolors";

// src/config/config-loader.ts
import { readFile } from "fs/promises";
import { resolve } from "path";

// src/config/config-schema.ts
import { z } from "zod";
var LayerRulesSchema = z.record(z.array(z.string())).optional();
var ForbiddenImportSchema = z.object({
  pattern: z.string(),
  from: z.string()
});
var ConfigSchema = z.object({
  entryPoint: z.string().optional(),
  srcDirectory: z.string().default("./src"),
  tsConfigPath: z.string().optional(),
  rules: z.object({
    maxFileLines: z.number().default(500),
    layerRules: LayerRulesSchema,
    forbiddenImports: z.array(ForbiddenImportSchema).optional()
  }).optional(),
  ignore: z.array(z.string()).optional()
});
var defaultConfig = {
  srcDirectory: "./src",
  rules: {
    maxFileLines: 500
  },
  ignore: ["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**"]
};

// src/config/config-loader.ts
var ConfigLoader = class {
  async load(configPath) {
    if (configPath) {
      return this.loadFromPath(configPath);
    }
    return this.loadFromDefaultPaths();
  }
  async loadFromPath(configPath) {
    try {
      const fullPath = resolve(process.cwd(), configPath);
      const content = await readFile(fullPath, "utf-8");
      return this.validate(JSON.parse(content));
    } catch (error) {
      throw new Error(`Failed to load config from ${configPath}: ${error}`);
    }
  }
  async loadFromDefaultPaths() {
    const defaultPaths = [
      "./archguard.config.json",
      "./.archguard.json"
    ];
    for (const path of defaultPaths) {
      const config = await this.tryLoadFromPath(path);
      if (config) return config;
    }
    return defaultConfig;
  }
  async tryLoadFromPath(path) {
    try {
      const fullPath = resolve(process.cwd(), path);
      const content = await readFile(fullPath, "utf-8");
      return this.validate(JSON.parse(content));
    } catch {
      return null;
    }
  }
  validate(data) {
    try {
      return ConfigSchema.parse(data);
    } catch (error) {
      throw new Error(`Invalid configuration: ${error}`);
    }
  }
};

// src/core/project-loader.ts
import { Project } from "ts-morph";
import { resolve as resolve2, relative } from "path";

// src/rules/utils/violation-utils.ts
function calculateSeverityByCount(count, thresholds) {
  if (count >= thresholds.critical) return "critical";
  if (count >= thresholds.warning) return "warning";
  return "info";
}
function calculatePenaltyByThreshold(count, threshold, basePenalty) {
  const excess = count - threshold;
  if (excess <= 0) return 0;
  const multiplier = Math.ceil(excess / threshold);
  return basePenalty * multiplier;
}
function createViolation(params) {
  const violation = {
    rule: params.rule,
    severity: params.severity,
    message: params.message,
    file: params.file,
    line: params.line ?? 1,
    impact: params.impact,
    suggestedFix: params.suggestedFix,
    penalty: params.penalty
  };
  if (params.relatedFile) {
    violation.relatedFile = params.relatedFile;
  }
  return violation;
}
function getThresholdFromConfig(ruleConfig, key = "threshold") {
  if (!ruleConfig || typeof ruleConfig !== "object") {
    return void 0;
  }
  const config = ruleConfig;
  const value = config[key];
  return typeof value === "number" ? value : void 0;
}
function shouldSkipNodeModules(filePath) {
  return filePath.includes("node_modules");
}
function isTestFile(filePath) {
  return /\.(spec|test)\.(ts|tsx|js|jsx)$/.test(filePath);
}
function isDeclarationFile(filePath) {
  return filePath.endsWith(".d.ts");
}
function getRelativePath(filePath, rootPath) {
  if (rootPath === "/" || rootPath === "\\") {
    return filePath.startsWith("/") || filePath.startsWith("\\") ? filePath.slice(1) : filePath;
  }
  return filePath.replace(rootPath + "/", "").replace(rootPath + "\\", "");
}
function createThresholdViolation(params) {
  return createViolation({
    rule: params.rule,
    severity: params.severity,
    message: params.message,
    file: getRelativePath(params.file, params.rootPath),
    line: params.line ?? 1,
    impact: params.impact,
    suggestedFix: params.suggestedFix,
    penalty: params.penalty
  });
}
function createArchitectureViolation(params) {
  return createViolation({
    rule: params.rule,
    severity: params.severity,
    message: params.message,
    file: getRelativePath(params.file, params.rootPath),
    relatedFile: getRelativePath(params.relatedFile, params.rootPath),
    line: 1,
    impact: params.impact,
    suggestedFix: params.suggestedFix,
    penalty: params.penalty
  });
}

// src/rules/utils/rule-helpers.ts
function processSourceFiles(sourceFiles, rootPath, processor, options = {}) {
  const {
    skipNodeModules = true,
    skipTests = false,
    onlyTests = false,
    skipDeclarations = true,
    customSkipCheck
  } = options;
  for (const sourceFile of sourceFiles) {
    const filePath = sourceFile.getFilePath();
    if (shouldSkipSourceFile(filePath, { skipNodeModules, skipTests, onlyTests, skipDeclarations, customSkipCheck })) {
      continue;
    }
    const relativePath = getRelativePath(filePath, rootPath);
    processor(sourceFile, filePath, relativePath);
  }
}
function shouldSkipSourceFile(filePath, options) {
  const skipChecks = [
    { condition: options.skipNodeModules, test: () => shouldSkipNodeModules(filePath) },
    { condition: options.onlyTests, test: () => !isTestFile(filePath) },
    { condition: options.skipTests, test: () => isTestFile(filePath) },
    { condition: options.skipDeclarations, test: () => isDeclarationFile(filePath) },
    { condition: !!options.customSkipCheck, test: () => options.customSkipCheck(filePath) }
  ];
  for (const { condition, test } of skipChecks) {
    if (condition && test()) {
      return true;
    }
  }
  return false;
}

// src/core/project-loader.ts
var ProjectLoader = class {
  project = null;
  async load(config) {
    const rootPath = process.cwd();
    const tsConfigPath = config.tsConfigPath || this.findTsConfig(rootPath);
    this.project = new Project({
      tsConfigFilePath: tsConfigPath,
      skipAddingFilesFromTsConfig: false
    });
    let sourceFiles = this.project.getSourceFiles();
    if (sourceFiles.length === 0) {
      const srcDir = resolve2(rootPath, config.srcDirectory);
      this.project.addSourceFilesAtPaths([
        `${srcDir}/**/*.ts`,
        `${srcDir}/**/*.tsx`
      ]);
      sourceFiles = this.project.getSourceFiles();
    }
    const filteredFiles = this.filterSourceFiles(sourceFiles, config);
    if (filteredFiles.length === 0) {
      console.warn(`
\u26A0\uFE0F  Warning: No TypeScript files found in ${config.srcDirectory}`);
      console.warn(`   Check your srcDirectory setting or tsconfig.json
`);
    }
    const sourceFilePaths = filteredFiles.map(
      (sf) => relative(rootPath, sf.getFilePath())
    );
    return {
      rootPath,
      sourceFiles: sourceFilePaths,
      dependencies: /* @__PURE__ */ new Map(),
      moduleCount: sourceFilePaths.length
    };
  }
  getProject() {
    if (!this.project) {
      throw new Error("Project not loaded. Call load() first.");
    }
    return this.project;
  }
  findTsConfig(rootPath) {
    const candidates = [
      resolve2(rootPath, "tsconfig.json"),
      resolve2(rootPath, "src", "tsconfig.json")
    ];
    for (const path of candidates) {
      try {
        return path;
      } catch {
        continue;
      }
    }
    return resolve2(rootPath, "tsconfig.json");
  }
  filterSourceFiles(sourceFiles, config) {
    const ignorePatterns = config.ignore || [];
    return sourceFiles.filter((sf) => {
      const filePath = sf.getFilePath();
      if (shouldSkipNodeModules(filePath)) {
        return false;
      }
      if (isTestFile(filePath)) {
        return false;
      }
      for (const pattern of ignorePatterns) {
        if (this.matchesPattern(filePath, pattern)) {
          return false;
        }
      }
      return true;
    });
  }
  matchesPattern(filePath, pattern) {
    const regex = new RegExp(
      pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*").replace(/\?/g, ".")
    );
    return regex.test(filePath);
  }
};

// src/core/graph-builder.ts
import { relative as relative2, dirname, resolve as resolve3 } from "path";
var GraphBuilder = class {
  build(project, rootPath) {
    const nodes = /* @__PURE__ */ new Map();
    const sourceFiles = project.getSourceFiles();
    for (const sourceFile of sourceFiles) {
      if (sourceFile.getFilePath().includes("node_modules")) {
        continue;
      }
      const filePath = this.normalizeFilePath(sourceFile, rootPath);
      const dependencies = this.extractDependencies(sourceFile, rootPath);
      nodes.set(filePath, {
        file: filePath,
        dependencies,
        dependents: /* @__PURE__ */ new Set()
      });
    }
    for (const [file, node] of nodes.entries()) {
      for (const dep of node.dependencies) {
        const depNode = nodes.get(dep);
        if (depNode) {
          depNode.dependents.add(file);
        }
      }
    }
    const cyclicGroups = this.detectCycles(nodes);
    return {
      nodes,
      cyclicGroups
    };
  }
  normalizeFilePath(sourceFile, rootPath) {
    return relative2(rootPath, sourceFile.getFilePath());
  }
  extractDependencies(sourceFile, rootPath) {
    const dependencies = /* @__PURE__ */ new Set();
    const importDeclarations = sourceFile.getImportDeclarations();
    for (const importDecl of importDeclarations) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      if (!moduleSpecifier.startsWith(".") && !moduleSpecifier.startsWith("/")) {
        continue;
      }
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
      }
    }
    return dependencies;
  }
  resolveImport(moduleSpecifier, fromDir, rootPath) {
    let resolved = resolve3(fromDir, moduleSpecifier);
    const extensions = [".ts", ".tsx", ".js", "/index.ts", "/index.tsx"];
    for (const ext of extensions) {
      try {
        const candidate = resolved + ext;
        return relative2(rootPath, candidate);
      } catch {
        continue;
      }
    }
    return relative2(rootPath, resolved);
  }
  detectCycles(nodes) {
    const cycles = [];
    const visited = /* @__PURE__ */ new Set();
    const recursionStack = /* @__PURE__ */ new Set();
    const currentPath = [];
    const dfs = (file) => {
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
};

// src/output/penalty-calculator.ts
var PenaltyCalculator = class _PenaltyCalculator {
  // Normalization configuration
  static BASELINE_PROJECT_SIZE = 1e4;
  static SMALL_PROJECT_THRESHOLD = 5e3;
  static MEDIUM_PROJECT_THRESHOLD = 5e4;
  static LARGE_PROJECT_THRESHOLD = 2e5;
  static NORMALIZATION_POWER_SMALL = 0.3;
  static NORMALIZATION_POWER_MEDIUM = 0.4;
  static NORMALIZATION_POWER_LARGE = 0.5;
  static MIN_LOC_FOR_NORMALIZATION = 1;
  // Impact thresholds
  static HIGH_IMPACT_THRESHOLD = 50;
  static MEDIUM_IMPACT_THRESHOLD = 20;
  static TOP_ISSUES_LIMIT = 5;
  categoryMultipliers = {
    structural: 1.2,
    design: 1,
    complexity: 0.8,
    hygiene: 0.5
  };
  severityMultipliers = {
    critical: 1,
    warning: 0.6,
    info: 0.3
  };
  ruleMetadata = /* @__PURE__ */ new Map([
    // === CORE ARCHITECTURE RULES (Structural) ===
    ["circular-deps", { name: "circular-deps", weight: 10, category: "structural" }],
    ["layer-violation", { name: "layer-violation", weight: 9, category: "structural" }],
    ["forbidden-imports", { name: "forbidden-imports", weight: 8, category: "structural" }],
    // === COUPLING & COMPLEXITY ANALYSIS (Design) ===
    ["too-many-imports", { name: "too-many-imports", weight: 7, category: "design" }],
    ["shotgun-surgery", { name: "shotgun-surgery", weight: 7, category: "design" }],
    ["data-clumps", { name: "data-clumps", weight: 6, category: "design" }],
    ["long-parameter-list", { name: "long-parameter-list", weight: 5, category: "design" }],
    // === COMPLEXITY (Cognitive Load) ===
    ["cyclomatic-complexity", { name: "cyclomatic-complexity", weight: 5, category: "complexity" }],
    ["deep-nesting", { name: "deep-nesting", weight: 4, category: "complexity" }],
    ["large-function", { name: "large-function", weight: 4, category: "complexity" }],
    ["max-file-lines", { name: "max-file-lines", weight: 3, category: "complexity" }],
    // === CODE HEALTH (Hygiene) ===
    ["duplicate-code", { name: "duplicate-code", weight: 6, category: "hygiene" }],
    ["unused-exports", { name: "unused-exports", weight: 2, category: "hygiene" }],
    ["dead-code", { name: "dead-code", weight: 3, category: "hygiene" }]
  ]);
  /**
   * Calculate total penalty with category-specific weights and normalization
   * @param violations Array of architectural violations
   * @param totalLOC Total lines of code (must be positive)
   * @throws {Error} If totalLOC is invalid
   */
  calculatePenalty(violations, totalLOC) {
    if (totalLOC < _PenaltyCalculator.MIN_LOC_FOR_NORMALIZATION) {
      throw new Error(`Invalid totalLOC: ${totalLOC}. Must be at least ${_PenaltyCalculator.MIN_LOC_FOR_NORMALIZATION}`);
    }
    const categorized = this.categorizeViolations(violations);
    const structural = this.calculateCategoryPenalty(categorized.structural, "structural");
    const design = this.calculateCategoryPenalty(categorized.design, "design");
    const complexity = this.calculateCategoryPenalty(categorized.complexity, "complexity");
    const hygiene = this.calculateCategoryPenalty(categorized.hygiene, "hygiene");
    const totalPenalty = structural.penalty + design.penalty + complexity.penalty + hygiene.penalty;
    const normalizedPenalty = this.normalizePenalty(totalPenalty, totalLOC);
    return {
      structural,
      design,
      complexity,
      hygiene,
      totalPenalty,
      normalizedPenalty
    };
  }
  /**
   * Categorize violations by rule category
   */
  categorizeViolations(violations) {
    const result = {
      structural: [],
      design: [],
      complexity: [],
      hygiene: []
    };
    for (const violation of violations) {
      const metadata = this.getRuleMetadata(violation.rule);
      const category = metadata?.category || "hygiene";
      result[category].push(violation);
    }
    return result;
  }
  /**
   * Calculate penalty for a specific category
   */
  calculateCategoryPenalty(violations, category) {
    let penalty = 0;
    for (const violation of violations) {
      const metadata = this.getRuleMetadata(violation.rule);
      const weight = metadata?.weight || 1;
      const severityMultiplier = this.severityMultipliers[violation.severity];
      const categoryMultiplier = this.categoryMultipliers[category];
      penalty += weight * severityMultiplier * categoryMultiplier;
    }
    const topIssues = violations.sort((a, b) => {
      const weightA = this.getRuleMetadata(a.rule)?.weight || 1;
      const weightB = this.getRuleMetadata(b.rule)?.weight || 1;
      return weightB - weightA;
    }).slice(0, _PenaltyCalculator.TOP_ISSUES_LIMIT);
    return {
      violations: violations.length,
      penalty: Math.round(penalty * 10) / 10,
      weight: this.categoryMultipliers[category],
      impact: this.getImpactLevel(penalty),
      topIssues
    };
  }
  /**
   * Normalize penalty based on project size using power-law scaling
   * Larger projects get increasingly favorable normalization to avoid unfair penalties
   */
  normalizePenalty(penalty, totalLOC) {
    if (totalLOC <= _PenaltyCalculator.SMALL_PROJECT_THRESHOLD) {
      return penalty;
    }
    const baselineSize = _PenaltyCalculator.BASELINE_PROJECT_SIZE;
    let powerFactor;
    if (totalLOC <= _PenaltyCalculator.MEDIUM_PROJECT_THRESHOLD) {
      powerFactor = _PenaltyCalculator.NORMALIZATION_POWER_SMALL;
    } else if (totalLOC <= _PenaltyCalculator.LARGE_PROJECT_THRESHOLD) {
      powerFactor = _PenaltyCalculator.NORMALIZATION_POWER_MEDIUM;
    } else {
      powerFactor = _PenaltyCalculator.NORMALIZATION_POWER_LARGE;
    }
    const normalizationFactor = Math.pow(baselineSize / totalLOC, powerFactor);
    return penalty * normalizationFactor;
  }
  /**
   * Get rule metadata
   */
  getRuleMetadata(ruleName) {
    const normalized = ruleName.toLowerCase().replace(/\s+/g, "-");
    return this.ruleMetadata.get(normalized);
  }
  /**
   * Determine impact level based on penalty threshold
   */
  getImpactLevel(penalty) {
    if (penalty >= _PenaltyCalculator.HIGH_IMPACT_THRESHOLD) return "HIGH";
    if (penalty >= _PenaltyCalculator.MEDIUM_IMPACT_THRESHOLD) return "MEDIUM";
    return "LOW";
  }
  /**
   * Get all rule metadata
   */
  getRuleMetadataMap() {
    return new Map(this.ruleMetadata);
  }
  /**
   * Get category multiplier
   */
  getCategoryMultiplier(category) {
    return this.categoryMultipliers[category];
  }
};

// src/output/score-calculator.ts
var ScoreCalculator = class _ScoreCalculator {
  static STARTING_SCORE = 100;
  static MIN_SCORE = 0;
  static MAX_SCORE = 100;
  penaltyCalculator = new PenaltyCalculator();
  calculate(violations, totalModules, totalLOC) {
    if (totalLOC && totalLOC > 0) {
      const breakdown = this.penaltyCalculator.calculatePenalty(violations, totalLOC);
      const rawScore = _ScoreCalculator.STARTING_SCORE - breakdown.normalizedPenalty;
      const score = Math.max(
        _ScoreCalculator.MIN_SCORE,
        Math.min(_ScoreCalculator.MAX_SCORE, Math.round(rawScore))
      );
      const status = this.getStatus(score);
      return { score, status, breakdown };
    }
    return this.calculateLegacy(violations, totalModules);
  }
  calculateLegacy(violations, totalModules) {
    let totalPenalty = 0;
    for (const violation of violations) {
      totalPenalty += violation.penalty;
    }
    const scalingFactor = this.calculateScalingFactor(totalModules, violations.length);
    const adjustedPenalty = totalPenalty / scalingFactor;
    const score = Math.max(_ScoreCalculator.MIN_SCORE, Math.round(_ScoreCalculator.STARTING_SCORE - adjustedPenalty));
    const status = this.getStatus(score);
    return { score, status };
  }
  calculateScalingFactor(totalModules, violationCount) {
    let baseScaling = 1;
    if (totalModules <= 100) {
      const violationRatio = violationCount / Math.max(1, totalModules);
      baseScaling = 1 + Math.min(violationRatio * 2, 8);
    } else if (totalModules <= 200) {
      baseScaling = totalModules / 50;
    } else {
      baseScaling = 4 + (totalModules - 200) / 100;
    }
    return Math.max(1, baseScaling);
  }
  getStatus(score) {
    if (score >= 90) return "Excellent";
    if (score >= 75) return "Healthy";
    if (score >= 60) return "Needs Attention";
    return "Critical";
  }
  getGrade(score) {
    if (score >= 90) return "EXCELLENT";
    if (score >= 75) return "GOOD";
    if (score >= 60) return "FAIR";
    if (score >= 40) return "POOR";
    return "CRITICAL";
  }
};

// src/output/risk-ranker.ts
var RiskRanker = class {
  rank(violations, topN = 5) {
    const sorted = [...violations].sort((a, b) => {
      const severityOrder = { critical: 3, warning: 2, info: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) {
        return severityDiff;
      }
      return b.penalty - a.penalty;
    });
    return sorted.slice(0, topN);
  }
  countBySeverity(violations) {
    return violations.reduce(
      (acc, v) => {
        acc[v.severity]++;
        return acc;
      },
      { critical: 0, warning: 0, info: 0 }
    );
  }
};

// src/core/rule-context.ts
function createRuleContext(project, graph, config, rootPath) {
  return { project, graph, config, rootPath };
}

// src/core/analyzer.ts
import { readFileSync, existsSync } from "fs";
import { join, basename } from "path";

// src/rules/circular-deps.rule.ts
var CircularDepsRule = class {
  name = "circular-deps";
  severity = "critical";
  penalty = 5;
  check(context) {
    const { graph, rootPath } = context;
    const violations = [];
    const processedCycles = /* @__PURE__ */ new Set();
    for (const cycle of graph.cyclicGroups) {
      const signature = [...cycle].sort().join("->");
      if (processedCycles.has(signature)) {
        continue;
      }
      processedCycles.add(signature);
      if (cycle.length < 2) {
        continue;
      }
      const cycleDescription = cycle.slice(0, 3).join(" \u2192 ");
      const mainFile = cycle[0];
      const relatedFile = cycle[1];
      violations.push(createArchitectureViolation({
        rule: "Circular Dependency",
        message: `Circular dependency detected: ${cycleDescription}${cycle.length > 3 ? "..." : ""}`,
        file: mainFile,
        relatedFile,
        rootPath,
        severity: this.severity,
        impact: "Circular dependencies create tight coupling, make code harder to test, and can cause initialization issues. They prevent proper modularization and increase change risk.",
        suggestedFix: `Break the cycle by:
  1. Introducing a shared abstraction/interface layer
  2. Using dependency injection
  3. Inverting the dependency (make one module depend on an abstraction)
  4. Extracting shared logic into a separate module`,
        penalty: this.penalty
      }));
    }
    return violations;
  }
};

// src/rules/layer-violation.rule.ts
var LayerViolationRule = class {
  name = "layer-violation";
  severity = "critical";
  penalty = 8;
  check(context) {
    const { project, graph, config, rootPath } = context;
    const violations = [];
    if (!config.rules?.layerRules) {
      return violations;
    }
    const layerRules = config.rules.layerRules;
    processSourceFiles(
      project.getSourceFiles(),
      rootPath,
      (_, filePath, relativePath) => {
        const fileLayer = this.getLayer(relativePath);
        if (!fileLayer || !layerRules[fileLayer]) {
          return;
        }
        const allowedLayers = layerRules[fileLayer];
        const node = graph.nodes.get(relativePath);
        if (!node) {
          return;
        }
        for (const dependency of node.dependencies) {
          const depLayer = this.getLayer(dependency);
          if (!depLayer) {
            continue;
          }
          if (!allowedLayers.includes(depLayer) && depLayer !== fileLayer) {
            const depFilePath = `${rootPath}/${dependency}`;
            violations.push(createArchitectureViolation({
              rule: "Layer Violation",
              severity: this.severity,
              message: `${fileLayer} layer importing from ${depLayer} layer`,
              file: filePath,
              relatedFile: depFilePath,
              rootPath,
              impact: `Violates architectural boundaries. The ${fileLayer} layer should not depend on ${depLayer}. This breaks separation of concerns and creates unwanted coupling between layers.`,
              suggestedFix: `Restructure dependencies to follow the layer hierarchy:
  ${fileLayer} \u2192 [${allowedLayers.join(", ")}]

Consider:
  1. Moving shared logic to an allowed layer (${allowedLayers[0] || "domain"})
  2. Using dependency inversion (interfaces/abstractions)
  3. Re-evaluating if ${dependency} belongs in a different layer`,
              penalty: this.penalty
            }));
          }
        }
      }
    );
    return violations;
  }
  getLayer(filePath) {
    const parts = filePath.split("/");
    const layers = ["ui", "application", "domain", "infra", "infrastructure"];
    for (const part of parts) {
      if (layers.includes(part.toLowerCase())) {
        return part.toLowerCase();
      }
    }
    return null;
  }
};

// src/rules/forbidden-imports.rule.ts
var ForbiddenImportsRule = class {
  name = "forbidden-imports";
  severity = "warning";
  penalty = 6;
  check(context) {
    const { project, config, rootPath } = context;
    const violations = [];
    if (!config.rules?.forbiddenImports) {
      return violations;
    }
    const forbiddenRules = config.rules.forbiddenImports;
    processSourceFiles(
      project.getSourceFiles(),
      rootPath,
      (sourceFile, filePath, relativePath) => {
        this.checkFileImports(sourceFile, filePath, relativePath, rootPath, forbiddenRules, violations);
      },
      { skipTests: false, skipDeclarations: false }
    );
    return violations;
  }
  checkFileImports(sourceFile, filePath, relativePath, rootPath, forbiddenRules, violations) {
    const imports = sourceFile.getImportDeclarations();
    for (const importDecl of imports) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      for (const rule of forbiddenRules) {
        if (!this.isForbiddenImport(moduleSpecifier, relativePath, rule)) continue;
        violations.push(createArchitectureViolation({
          rule: "Forbidden Import",
          severity: this.severity,
          message: `Importing "${moduleSpecifier}" from "${relativePath}"`,
          file: filePath,
          relatedFile: moduleSpecifier,
          rootPath,
          impact: `This import violates project import rules. Forbidden imports can introduce unwanted dependencies, couple unrelated modules, or import test code into production.`,
          suggestedFix: `Remove this import or restructure your code:
  1. If this is a test utility, move it to a shared test helper
  2. If this is production code, refactor to avoid the dependency
  3. Consider if the import rule needs updating`,
          penalty: this.penalty
        }));
      }
    }
  }
  isForbiddenImport(moduleSpecifier, filePath, rule) {
    return this.matchesPattern(moduleSpecifier, rule.pattern) && this.matchesPattern(filePath, rule.from);
  }
  /**
   * Matches a value against a glob pattern
   * Supports: asterisk (any chars except /), double-asterisk (any chars including /)
   * 
   * Examples:
   * - "src/asterisk.ts" matches "src/file.ts" but not "src/dir/file.ts"
   * - "src/double-asterisk" matches "src/file.ts" and "src/dir/file.ts"
   * - "double-asterisk/asterisk.test.ts" matches any test.ts file in any directory
   */
  matchesPattern(value, pattern) {
    let regexPattern = pattern.replace(/[.+^${}()|[\\\]]/g, "\\$&").replace(/\*\*/g, "\0").replace(/\*/g, "[^/]*").replace(/\0/g, ".*");
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(value);
  }
};

// src/rules/too-many-imports.rule.ts
var TooManyImportsRule = class {
  name = "too-many-imports";
  severity = "warning";
  penalty = 5;
  check(context) {
    const { project, config, rootPath } = context;
    const violations = [];
    const threshold = config.rules?.["too-many-imports"]?.maxImports || 15;
    processSourceFiles(
      project.getSourceFiles(),
      rootPath,
      (sourceFile, _, __) => {
        const importDeclarations = sourceFile.getImportDeclarations();
        const importCount = importDeclarations.length;
        if (importCount > threshold) {
          const severity = calculateSeverityByCount(importCount, { critical: 25, warning: 15 });
          violations.push(createThresholdViolation({
            rule: "Too Many Imports",
            severity,
            message: `File has ${importCount} imports (max: ${threshold})`,
            file: sourceFile.getFilePath(),
            rootPath,
            line: 1,
            impact: "Increases coupling, reduces modularity, and violates Single Responsibility Principle",
            suggestedFix: `Refactor file into smaller, focused modules. Remove unused imports. Consider facade pattern to reduce direct dependencies. Target: <${threshold} imports per file.`,
            penalty: calculatePenaltyByThreshold(importCount, threshold, this.penalty)
          }));
        }
      }
    );
    return violations;
  }
};

// src/rules/cyclomatic-complexity.rule.ts
import { SyntaxKind as SyntaxKind2 } from "ts-morph";

// src/rules/base/function-analysis.rule.ts
import { SyntaxKind } from "ts-morph";
var FunctionAnalysisRule = class {
  /**
   * Main check method that orchestrates the analysis
   * This implements the template method pattern
   */
  check(context) {
    const { project, config, rootPath } = context;
    const violations = [];
    const sourceFiles = project.getSourceFiles();
    const configValue = config.rules?.[this.name];
    const threshold = configValue?.[this.getConfigKey()] || this.getDefaultThreshold();
    for (const sourceFile of sourceFiles) {
      const filePath = sourceFile.getFilePath();
      if (shouldSkipNodeModules(filePath)) {
        continue;
      }
      const checkContext = { filePath, rootPath, threshold, violations };
      this.analyzeFunctions(sourceFile, checkContext);
      this.analyzeMethods(sourceFile, checkContext);
      this.analyzeArrowFunctions(sourceFile, checkContext);
    }
    return violations;
  }
  /**
   * Analyze all function declarations in a source file
   */
  analyzeFunctions(sourceFile, context) {
    const functions = sourceFile.getFunctions();
    for (const func of functions) {
      this.checkFunction(func, context);
    }
  }
  /**
   * Analyze all class methods in a source file
   */
  analyzeMethods(sourceFile, context) {
    const classes = sourceFile.getClasses();
    for (const cls of classes) {
      const methods = cls.getMethods();
      for (const method of methods) {
        this.checkMethod(method, context);
      }
    }
  }
  /**
   * Analyze all arrow functions in a source file
   */
  analyzeArrowFunctions(sourceFile, context) {
    const variableStatements = sourceFile.getVariableStatements();
    for (const stmt of variableStatements) {
      const declarations = stmt.getDeclarations();
      for (const decl of declarations) {
        const initializer = decl.getInitializer();
        if (initializer && initializer.getKind() === SyntaxKind.ArrowFunction) {
          const arrowContext = {
            ...context,
            arrowFunc: initializer,
            name: decl.getName()
          };
          this.checkArrowFunction(arrowContext);
        }
      }
    }
  }
  /**
   * Helper method to create a function violation with standardized structure
   */
  createFunctionViolation(params) {
    return {
      rule: params.rule,
      severity: params.severity,
      message: `Function '${params.functionName}' has ${params.metric} of ${params.metricValue} (max: ${params.threshold})`,
      file: getRelativePath(params.filePath, params.rootPath),
      line: params.line,
      impact: params.impact,
      suggestedFix: params.suggestedFix,
      penalty: params.penalty
    };
  }
  /**
   * Helper method to create a method violation with standardized structure
   */
  createMethodViolation(params) {
    return {
      rule: params.rule,
      severity: params.severity,
      message: `Method '${params.className}.${params.methodName}' has ${params.metric} of ${params.metricValue} (max: ${params.threshold})`,
      file: getRelativePath(params.filePath, params.rootPath),
      line: params.line,
      impact: params.impact,
      suggestedFix: params.suggestedFix,
      penalty: params.penalty
    };
  }
  /**
   * Helper method to create an arrow function violation with standardized structure
   */
  createArrowFunctionViolation(params) {
    return {
      rule: params.rule,
      severity: params.severity,
      message: `Arrow function '${params.functionName}' has ${params.metric} of ${params.metricValue} (max: ${params.threshold})`,
      file: getRelativePath(params.filePath, params.rootPath),
      line: params.line,
      impact: params.impact,
      suggestedFix: params.suggestedFix,
      penalty: params.penalty
    };
  }
  /**
   * Helper to get class name from a method's parent
   */
  getClassName(method) {
    const parent = method.getParent();
    return parent && "getName" in parent && typeof parent.getName === "function" ? parent.getName() ?? "<unknown>" : "<unknown>";
  }
  /**
   * Template method for generic function checking
   * Extracts common violation creation logic
   */
  checkFunctionGeneric(params) {
    const { body, getName, getLine, context, rule, metric, impact, suggestedFix, calculateMetric, calculateSeverity: getSeverity, calculatePenalty: getPenalty } = params;
    if (!body) return;
    const metricValue = calculateMetric(body);
    if (metricValue > context.threshold) {
      context.violations.push(
        this.createFunctionViolation({
          rule,
          severity: getSeverity(metricValue),
          functionName: getName() || "<anonymous>",
          metric,
          metricValue,
          threshold: context.threshold,
          line: getLine(),
          filePath: context.filePath,
          rootPath: context.rootPath,
          impact,
          suggestedFix,
          penalty: getPenalty(metricValue)
        })
      );
    }
  }
  /**
   * Template method for generic method checking
   */
  checkMethodGeneric(params) {
    const { method, body, context, rule, metric, impact, suggestedFix, calculateMetric, calculateSeverity: getSeverity, calculatePenalty: getPenalty } = params;
    if (!body) return;
    const metricValue = calculateMetric(body);
    if (metricValue > context.threshold) {
      context.violations.push(
        this.createMethodViolation({
          rule,
          severity: getSeverity(metricValue),
          className: this.getClassName(method),
          methodName: method.getName(),
          metric,
          metricValue,
          threshold: context.threshold,
          line: method.getStartLineNumber(),
          filePath: context.filePath,
          rootPath: context.rootPath,
          impact,
          suggestedFix,
          penalty: getPenalty(metricValue)
        })
      );
    }
  }
  /**
   * Template method for generic arrow function checking
   */
  checkArrowFunctionGeneric(params) {
    const { context, body, rule, metric, impact, suggestedFix, calculateMetric, calculateSeverity: getSeverity, calculatePenalty: getPenalty } = params;
    if (!body) return;
    const metricValue = calculateMetric(body);
    if (metricValue > context.threshold) {
      context.violations.push(
        this.createArrowFunctionViolation({
          rule,
          severity: getSeverity(metricValue),
          functionName: context.name,
          metric,
          metricValue,
          threshold: context.threshold,
          line: context.arrowFunc.getStartLineNumber(),
          filePath: context.filePath,
          rootPath: context.rootPath,
          impact,
          suggestedFix,
          penalty: getPenalty(metricValue)
        })
      );
    }
  }
};

// src/rules/utils/severity-calculator.ts
function calculateSeverity(value, thresholds) {
  if (value > thresholds.critical) return "critical";
  if (value > thresholds.warning) return "warning";
  return "info";
}
function calculatePenalty(value, threshold, thresholds, config) {
  const excess = value - threshold;
  if (value > thresholds.critical) {
    return config.criticalBase + excess * config.criticalMultiplier;
  } else if (value > thresholds.warning) {
    return config.warningBase + excess * config.warningMultiplier;
  } else {
    const multiplier = config.infoMultiplier ?? 1;
    return config.infoBase + excess * multiplier;
  }
}

// src/rules/utils/function-analysis-config.ts
var STANDARD_PENALTY_CONFIG = {
  criticalBase: 15,
  criticalMultiplier: 2,
  warningBase: 10,
  warningMultiplier: 1.5,
  infoBase: 5
};
var COMPLEXITY_IMPACT = "High complexity increases bug probability and makes code harder to understand and test";
var NESTING_IMPACT = "Increases complexity and bug risk, makes code harder to understand and test";
function createSeverityThresholds(critical, warning) {
  return { critical, warning };
}

// src/rules/cyclomatic-complexity.rule.ts
var SEVERITY_THRESHOLDS = createSeverityThresholds(20, 15);
var PENALTY_CONFIG = {
  ...STANDARD_PENALTY_CONFIG,
  criticalBase: 20
  // Higher penalty for cyclomatic complexity
};
var CyclomaticComplexityRule = class extends FunctionAnalysisRule {
  name = "cyclomatic-complexity";
  severity = "info";
  penalty = 10;
  getConfigKey() {
    return "maxComplexity";
  }
  getDefaultThreshold() {
    return 10;
  }
  checkFunction(func, context) {
    this.checkFunctionGeneric({
      body: func.getBody(),
      getName: () => func.getName() || "anonymous",
      getLine: () => func.getStartLineNumber(),
      context,
      rule: "High Cyclomatic Complexity",
      metric: "cyclomatic complexity",
      impact: COMPLEXITY_IMPACT,
      suggestedFix: "Break down into smaller functions with single responsibilities. Extract complex conditionals into helper methods. Simplify logic by using early returns, strategy pattern, or lookup tables. Target complexity <10 for easier testing.",
      calculateMetric: (body) => this.calculateComplexity(body),
      calculateSeverity: (value) => calculateSeverity(value, SEVERITY_THRESHOLDS),
      calculatePenalty: (value) => calculatePenalty(value, context.threshold, SEVERITY_THRESHOLDS, PENALTY_CONFIG)
    });
  }
  checkMethod(method, context) {
    this.checkMethodGeneric({
      method,
      body: method.getBody(),
      context,
      rule: "High Cyclomatic Complexity",
      metric: "cyclomatic complexity",
      impact: COMPLEXITY_IMPACT,
      suggestedFix: "Extract complex logic into helper methods. Use polymorphism instead of conditionals. Simplify nested conditions with guard clauses. Consider state pattern for complex state management.",
      calculateMetric: (body) => this.calculateComplexity(body),
      calculateSeverity: (value) => calculateSeverity(value, SEVERITY_THRESHOLDS),
      calculatePenalty: (value) => calculatePenalty(value, context.threshold, SEVERITY_THRESHOLDS, PENALTY_CONFIG)
    });
  }
  checkArrowFunction(context) {
    this.checkArrowFunctionGeneric({
      context,
      body: context.arrowFunc.getBody(),
      rule: "High Cyclomatic Complexity",
      metric: "cyclomatic complexity",
      impact: COMPLEXITY_IMPACT,
      suggestedFix: "Convert to named function and break down logic. Extract decision points into separate functions. Use array methods (map, filter, reduce) to simplify iterations.",
      calculateMetric: (body) => this.calculateComplexity(body),
      calculateSeverity: (value) => calculateSeverity(value, SEVERITY_THRESHOLDS),
      calculatePenalty: (value) => calculatePenalty(value, context.threshold, SEVERITY_THRESHOLDS, PENALTY_CONFIG)
    });
  }
  /**
   * Calculate cyclomatic complexity by counting decision points
   * Complexity = 1 + number of decision points
   */
  calculateComplexity(node) {
    let complexity = 1;
    const DECISION_POINT_KINDS = /* @__PURE__ */ new Set([
      SyntaxKind2.IfStatement,
      SyntaxKind2.ConditionalExpression,
      SyntaxKind2.ForStatement,
      SyntaxKind2.ForInStatement,
      SyntaxKind2.ForOfStatement,
      SyntaxKind2.WhileStatement,
      SyntaxKind2.DoStatement,
      SyntaxKind2.CaseClause,
      SyntaxKind2.CatchClause
    ]);
    const LOGICAL_OPERATORS = /* @__PURE__ */ new Set([
      SyntaxKind2.AmpersandAmpersandToken,
      // &&
      SyntaxKind2.BarBarToken,
      // ||
      SyntaxKind2.QuestionQuestionToken
      // ??
    ]);
    const isLogicalBinaryExpression = (n) => {
      const binaryExpr = n;
      const operator = binaryExpr.getOperatorToken().getKind();
      return LOGICAL_OPERATORS.has(operator);
    };
    const countDecisionPoints = (n) => {
      const kind = n.getKind();
      if (DECISION_POINT_KINDS.has(kind)) {
        complexity++;
      } else if (kind === SyntaxKind2.BinaryExpression && isLogicalBinaryExpression(n)) {
        complexity++;
      }
      n.getChildren().forEach(countDecisionPoints);
    };
    countDecisionPoints(node);
    return complexity;
  }
};

// src/rules/deep-nesting.rule.ts
import { SyntaxKind as SyntaxKind3 } from "ts-morph";
var SEVERITY_THRESHOLDS2 = createSeverityThresholds(5, 4);
var DeepNestingRule = class extends FunctionAnalysisRule {
  name = "deep-nesting";
  severity = "info";
  penalty = 3;
  getConfigKey() {
    return "maxDepth";
  }
  getDefaultThreshold() {
    return 3;
  }
  checkFunction(func, context) {
    this.checkFunctionGeneric({
      body: func.getBody(),
      getName: () => func.getName() ?? "<anonymous>",
      getLine: () => func.getStartLineNumber(),
      context,
      rule: "Deep Nesting",
      metric: "nesting depth",
      impact: NESTING_IMPACT,
      suggestedFix: "Refactor nested blocks into smaller functions with descriptive names. Use early returns/guards to reduce nesting. Apply Extract Method pattern for complex conditional logic.",
      calculateMetric: (body) => this.calculateNestingDepth(body, 0),
      calculateSeverity: (value) => calculateSeverity(value, SEVERITY_THRESHOLDS2),
      calculatePenalty: (value) => calculatePenalty(value, context.threshold, SEVERITY_THRESHOLDS2, STANDARD_PENALTY_CONFIG)
    });
  }
  checkMethod(method, context) {
    this.checkMethodGeneric({
      method,
      body: method.getBody(),
      context,
      rule: "Deep Nesting",
      metric: "nesting depth",
      impact: NESTING_IMPACT,
      suggestedFix: "Break method into smaller helper methods. Use early returns to flatten conditional logic. Extract nested blocks into separate private methods.",
      calculateMetric: (body) => this.calculateNestingDepth(body, 0),
      calculateSeverity: (value) => calculateSeverity(value, SEVERITY_THRESHOLDS2),
      calculatePenalty: (value) => calculatePenalty(value, context.threshold, SEVERITY_THRESHOLDS2, STANDARD_PENALTY_CONFIG)
    });
  }
  checkArrowFunction(context) {
    this.checkArrowFunctionGeneric({
      context,
      body: context.arrowFunc.getBody(),
      rule: "Deep Nesting",
      metric: "nesting depth",
      impact: NESTING_IMPACT,
      suggestedFix: "Break method into smaller helper methods. Use early returns and guard clauses to reduce nesting depth.",
      calculateMetric: (body) => this.calculateNestingDepth(body, 0),
      calculateSeverity: (value) => calculateSeverity(value, SEVERITY_THRESHOLDS2),
      calculatePenalty: (value) => calculatePenalty(value, context.threshold, SEVERITY_THRESHOLDS2, STANDARD_PENALTY_CONFIG)
    });
  }
  /**
   * Recursively calculate maximum nesting depth
   * Counts if/for/while/try/switch/case statements
   */
  calculateNestingDepth(node, currentDepth) {
    let maxDepth = currentDepth;
    const children = node.getChildren();
    for (const child of children) {
      const childDepth = this.getChildDepth(child, currentDepth);
      const depth = this.calculateNestingDepth(child, childDepth);
      maxDepth = Math.max(maxDepth, depth);
    }
    return maxDepth;
  }
  getChildDepth(child, currentDepth) {
    const kind = child.getKind();
    if (this.isNestingStatement(kind)) {
      return currentDepth + 1;
    }
    return currentDepth;
  }
  isNestingStatement(kind) {
    const nestingKinds = [
      SyntaxKind3.IfStatement,
      SyntaxKind3.ForStatement,
      SyntaxKind3.ForInStatement,
      SyntaxKind3.ForOfStatement,
      SyntaxKind3.WhileStatement,
      SyntaxKind3.DoStatement,
      SyntaxKind3.SwitchStatement,
      SyntaxKind3.TryStatement,
      SyntaxKind3.CatchClause
    ];
    return nestingKinds.includes(kind);
  }
};

// src/rules/large-function.rule.ts
var SEVERITY_THRESHOLDS3 = createSeverityThresholds(100, 75);
var PENALTY_CONFIG2 = {
  criticalBase: 15,
  criticalMultiplier: 0.1,
  warningBase: 10,
  warningMultiplier: 0.1,
  infoBase: 5,
  infoMultiplier: 0.05
};
var LargeFunctionRule = class extends FunctionAnalysisRule {
  name = "large-function";
  severity = "info";
  penalty = 5;
  getConfigKey() {
    return "maxLines";
  }
  getDefaultThreshold() {
    return 50;
  }
  checkFunction(func, context) {
    this.checkFunctionGeneric({
      body: func.getBody(),
      getName: () => func.getName() ?? "<anonymous>",
      getLine: () => func.getStartLineNumber(),
      context,
      rule: "Large Function",
      metric: "lines",
      impact: "Reduces testability, code comprehension, and maintainability",
      suggestedFix: "Split large function into smaller helper functions. Extract complex logic into well-named private functions or utility modules.",
      calculateMetric: (body) => this.getBodyLineCount(body.getText()),
      calculateSeverity: (value) => calculateSeverity(value, SEVERITY_THRESHOLDS3),
      calculatePenalty: (value) => calculatePenalty(value, context.threshold, SEVERITY_THRESHOLDS3, PENALTY_CONFIG2)
    });
  }
  checkMethod(method, context) {
    this.checkMethodGeneric({
      method,
      body: method.getBody(),
      context,
      rule: "Large Function",
      metric: "lines",
      impact: "Reduces testability, code comprehension, and maintainability",
      suggestedFix: "Split method into smaller helper methods. Extract complex logic into separate private methods or utility functions.",
      calculateMetric: (body) => this.getBodyLineCount(body.getText()),
      calculateSeverity: (value) => calculateSeverity(value, SEVERITY_THRESHOLDS3),
      calculatePenalty: (value) => calculatePenalty(value, context.threshold, SEVERITY_THRESHOLDS3, PENALTY_CONFIG2)
    });
  }
  checkArrowFunction(context) {
    this.checkArrowFunctionGeneric({
      context,
      body: context.arrowFunc.getBody(),
      rule: "Large Function",
      metric: "lines",
      impact: "Reduces testability, code comprehension, and maintainability",
      suggestedFix: "Convert to named function and break down logic. Extract complex operations into separate functions.",
      calculateMetric: (body) => this.getBodyLineCount(body.getText()),
      calculateSeverity: (value) => calculateSeverity(value, SEVERITY_THRESHOLDS3),
      calculatePenalty: (value) => calculatePenalty(value, context.threshold, SEVERITY_THRESHOLDS3, PENALTY_CONFIG2)
    });
  }
  getBodyLineCount(bodyText) {
    const cleaned = bodyText.trim();
    const withoutBraces = cleaned.slice(1, -1).trim();
    const lines = withoutBraces.split("\n");
    return lines.filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith("//") && !trimmed.startsWith("/*") && !trimmed.startsWith("*");
    }).length;
  }
};

// src/rules/max-file-lines.rule.ts
var MaxFileLinesRule = class _MaxFileLinesRule {
  name = "max-file-lines";
  severity = "warning";
  penalty = 3;
  static DEFAULT_MAX_LINES = 500;
  static CRITICAL_THRESHOLD = 1e3;
  static WARNING_THRESHOLD = 500;
  check(context) {
    const { project, config, rootPath } = context;
    const violations = [];
    const maxLines = config.rules?.maxFileLines || _MaxFileLinesRule.DEFAULT_MAX_LINES;
    processSourceFiles(
      project.getSourceFiles(),
      rootPath,
      (sourceFile) => {
        const lineCount = sourceFile.getEndLineNumber();
        if (lineCount > maxLines) {
          const severity = calculateSeverityByCount(lineCount, {
            critical: _MaxFileLinesRule.CRITICAL_THRESHOLD,
            warning: _MaxFileLinesRule.WARNING_THRESHOLD
          });
          violations.push(createThresholdViolation({
            rule: "Max File Lines",
            severity,
            message: `File has ${lineCount} lines (max: ${maxLines})`,
            file: sourceFile.getFilePath(),
            rootPath,
            line: 1,
            impact: "Large files are harder to maintain, test, and understand. They often indicate poor separation of concerns and violate Single Responsibility Principle.",
            suggestedFix: `Split this file into smaller, focused modules:
  1. Group related functionality into separate files
  2. Extract classes, interfaces, and utilities
  3. Organize by responsibility (e.g., services, models, utils)
  4. Consider using barrel exports (index.ts) for clean imports
  
  Target: <${maxLines} lines per file`,
            penalty: this.calculatePenalty(lineCount, maxLines)
          }));
        }
      }
    );
    return violations;
  }
  calculatePenalty(lineCount, threshold) {
    const excess = lineCount - threshold;
    const excessFactor = excess / threshold;
    return Math.min(10, Math.round(this.penalty + excessFactor * 5));
  }
};

// src/rules/base/parameter-analysis.rule.ts
import { Node as Node3 } from "ts-morph";
import { relative as relative3 } from "path";
var ParameterAnalysisRule = class {
  /**
   * Main check method that iterates over source files
   * Uses template method pattern to process different function types
   */
  check(context) {
    const sourceFiles = context.project.getSourceFiles();
    for (const sourceFile of sourceFiles) {
      if (this.shouldSkipFile(sourceFile.getFilePath())) continue;
      const relativePath = relative3(context.rootPath, sourceFile.getFilePath());
      this.processFunctions(sourceFile, relativePath);
      this.processClasses(sourceFile, relativePath);
      this.processArrowFunctions(sourceFile, relativePath);
    }
    return this.getViolations();
  }
  /**
   * Determine if a file should be skipped during analysis
   * Override in subclasses for custom skip logic
   */
  shouldSkipFile(filePath) {
    return filePath.includes("node_modules") || filePath.endsWith(".d.ts");
  }
  /**
   * Process all standalone functions in a source file
   */
  processFunctions(sourceFile, relativePath) {
    const functions = sourceFile.getFunctions();
    for (const func of functions) {
      this.processFunction(func, relativePath);
    }
  }
  /**
   * Process all classes (methods and constructors) in a source file
   */
  processClasses(sourceFile, relativePath) {
    const classes = sourceFile.getClasses();
    for (const cls of classes) {
      const className = cls.getName() || "<anonymous>";
      for (const ctor of cls.getConstructors()) {
        this.processConstructor(ctor, className, relativePath);
      }
      for (const method of cls.getMethods()) {
        this.processMethod(method, className, relativePath);
      }
      for (const staticMethod of cls.getStaticMethods()) {
        this.processMethod(staticMethod, className, relativePath);
      }
    }
  }
  /**
   * Process all arrow functions in a source file
   */
  processArrowFunctions(sourceFile, relativePath) {
    const variableStatements = sourceFile.getVariableStatements();
    for (const stmt of variableStatements) {
      const declarations = stmt.getDeclarations();
      for (const decl of declarations) {
        const initializer = decl.getInitializer();
        if (initializer && Node3.isArrowFunction(initializer)) {
          const varName = decl.getName();
          this.processArrowFunction(initializer, varName, relativePath, decl);
        }
      }
    }
  }
};

// src/rules/long-parameter-list.rule.ts
var CRITICAL_PARAMETER_THRESHOLD = 6;
var LongParameterListRule = class extends ParameterAnalysisRule {
  name = "long-parameter-list";
  severity = "warning";
  penalty = CRITICAL_PARAMETER_THRESHOLD;
  defaultThreshold = 4;
  threshold = this.defaultThreshold;
  violations = [];
  /**
   * Override check to set threshold from config before processing
   */
  check(context) {
    this.violations = [];
    const ruleConfig = context.config.rules?.[this.name];
    this.threshold = getThresholdFromConfig(ruleConfig, "maxParameters") ?? this.defaultThreshold;
    return super.check(context);
  }
  shouldSkipFile(filePath) {
    return shouldSkipNodeModules(filePath);
  }
  processFunction(func, relativePath) {
    const params = func.getParameters();
    if (params.length > this.threshold) {
      const functionName = func.getName() || "<anonymous>";
      this.violations.push(this.createViolation({
        name: functionName,
        count: params.length,
        threshold: this.threshold,
        file: relativePath,
        line: func.getStartLineNumber(),
        type: "function"
      }));
    }
  }
  processMethod(method, className, relativePath) {
    const params = method.getParameters();
    if (params.length > this.threshold) {
      const methodName = method.getName();
      this.violations.push(this.createViolation({
        name: `${className}.${methodName}`,
        count: params.length,
        threshold: this.threshold,
        file: relativePath,
        line: method.getStartLineNumber(),
        type: "method"
      }));
    }
  }
  processConstructor(constructor, className, relativePath) {
    const params = constructor.getParameters();
    if (params.length <= 6) return;
    if (params.length > this.threshold) {
      this.violations.push(this.createViolation({
        name: `${className}.constructor`,
        count: params.length,
        threshold: this.threshold,
        file: relativePath,
        line: constructor.getStartLineNumber(),
        type: "constructor"
      }));
    }
  }
  processArrowFunction(arrowFunc, varName, relativePath, declaration) {
    const params = arrowFunc.getParameters();
    if (params.length > this.threshold) {
      this.violations.push(this.createViolation({
        name: varName,
        count: params.length,
        threshold: this.threshold,
        file: relativePath,
        line: declaration.getStartLineNumber(),
        type: "arrow function"
      }));
    }
  }
  getViolations() {
    return this.violations;
  }
  createViolation(data) {
    const fixMessage = data.type === "constructor" ? "Use dependency injection container or grouping configuration objects." : `Reduce parameters using:
  1. Parameter object pattern (group related params)
  2. Builder pattern for complex construction
  3. Extract to multiple focused functions
  4. Store configuration in class properties`;
    return createViolation({
      rule: "Long Parameter List",
      severity: this.getSeverityByCount(data.count),
      message: `${data.type === "method" ? "Method" : data.type === "constructor" ? "Constructor" : "Function"} '${data.name}' has ${data.count} parameters (max: ${data.threshold})`,
      file: data.file,
      line: data.line,
      impact: "Reduces code readability, increases testing complexity, and makes refactoring harder",
      suggestedFix: fixMessage,
      penalty: this.calculatePenalty(data.count, data.threshold)
    });
  }
  getSeverityByCount(count) {
    if (count > CRITICAL_PARAMETER_THRESHOLD) return "critical";
    if (count >= 5) return "warning";
    return "info";
  }
  calculatePenalty(count, threshold) {
    return Math.min(30, (count - threshold) * 5);
  }
};

// src/rules/data-clumps.rule.ts
var DataClumpsRule = class extends ParameterAnalysisRule {
  name = "data-clumps";
  severity = "warning";
  penalty = 10;
  defaultMinOccurrences = 3;
  minOccurrences = this.defaultMinOccurrences;
  parameterGroups = /* @__PURE__ */ new Map();
  /**
   * Override check to set config and reset state before processing
   */
  check(context) {
    this.parameterGroups = /* @__PURE__ */ new Map();
    const ruleConfig = context.config.rules?.[this.name];
    this.minOccurrences = getThresholdFromConfig(ruleConfig, "minOccurrences") ?? this.defaultMinOccurrences;
    return super.check(context);
  }
  processFunction(func, relativePath) {
    const funcName = func.getName() || "anonymous";
    const context = {
      filePath: relativePath,
      functionName: funcName
    };
    this.processParameters(func, context);
  }
  processMethod(method, className, relativePath) {
    const methodName = method.getName();
    const context = {
      filePath: relativePath,
      functionName: methodName,
      className
    };
    this.processParameters(method, context);
  }
  processConstructor(constructor, className, relativePath) {
    const context = {
      filePath: relativePath,
      functionName: "constructor",
      className
    };
    this.processParameters(constructor, context);
  }
  processArrowFunction(arrowFunc, varName, relativePath, _) {
    const context = {
      filePath: relativePath,
      functionName: varName
    };
    this.processParameters(arrowFunc, context);
  }
  getViolations() {
    return this.generateViolations();
  }
  processParameters(node, context) {
    const parameters = node.getParameters();
    if (parameters.length < 3) return;
    const paramNames = parameters.map((p) => p.getName());
    const paramTypes = parameters.map((p) => p.getType().getText());
    const signature = paramNames.map((name, i) => `${name}:${paramTypes[i]}`).join(",");
    const methodName = context.className ? `${context.className}.${context.functionName}` : context.functionName;
    if (this.parameterGroups.has(signature)) {
      this.parameterGroups.get(signature)?.occurrences.push({
        file: context.filePath,
        method: methodName,
        line: node.getStartLineNumber()
      });
    } else {
      this.parameterGroups.set(signature, {
        parameters: paramNames,
        types: paramTypes,
        occurrences: [{
          file: context.filePath,
          method: methodName,
          line: node.getStartLineNumber()
        }]
      });
    }
  }
  generateViolations() {
    const violations = [];
    for (const group of this.parameterGroups.values()) {
      if (group.occurrences.length >= this.minOccurrences) {
        violations.push(createViolation({
          rule: "Data Clumps",
          severity: this.severity,
          message: `Found data clump with ${group.parameters.length} parameters (${group.parameters.join(", ")}) appearing in ${group.occurrences.length} locations.`,
          file: group.occurrences[0].file,
          line: group.occurrences[0].line,
          impact: "Repeating groups of parameters being passed around indicates missing abstraction.",
          suggestedFix: `Extract parameters (${group.parameters.join(", ")}) into a new class or interface.`,
          penalty: this.penalty
        }));
      }
    }
    return violations;
  }
};

// src/rules/shotgun-surgery.rule.ts
import { relative as relative4 } from "path";
var ShotgunSurgeryRule = class {
  name = "shotgun-surgery";
  severity = "info";
  penalty = 6;
  defaultThreshold = 5;
  check(context) {
    const sourceFiles = context.project.getSourceFiles();
    const ruleConfig = context.config.rules?.[this.name];
    const threshold = getThresholdFromConfig(ruleConfig, "minFiles") ?? this.defaultThreshold;
    const symbolUsages = this.collectExportedSymbols(sourceFiles, context.rootPath);
    this.trackImports(sourceFiles, context.rootPath, symbolUsages);
    return this.generateViolations(symbolUsages, threshold);
  }
  collectExportedSymbols(sourceFiles, rootPath) {
    const symbolUsages = /* @__PURE__ */ new Map();
    processSourceFiles(
      sourceFiles,
      rootPath,
      (sourceFile, _, relativePath) => {
        const exportedDeclarations = sourceFile.getExportedDeclarations();
        for (const [name, declarations] of exportedDeclarations) {
          if (declarations.length === 0) continue;
          const mainDecl = declarations[0];
          const kindName = mainDecl.getKindName();
          if (["InterfaceDeclaration", "TypeAliasDeclaration", "EnumDeclaration"].includes(kindName)) {
            continue;
          }
          const key = `${relativePath}::${name}`;
          if (!symbolUsages.has(key)) {
            symbolUsages.set(key, {
              name,
              usedInFiles: /* @__PURE__ */ new Set(),
              usageCount: 0
            });
          }
        }
      }
    );
    return symbolUsages;
  }
  trackImports(sourceFiles, rootPath, symbolUsages) {
    processSourceFiles(
      sourceFiles,
      rootPath,
      (sourceFile, _, relativePath) => {
        const imports = sourceFile.getImportDeclarations();
        for (const importDecl of imports) {
          const moduleSpecifier = importDecl.getModuleSpecifierValue();
          if (!moduleSpecifier.startsWith(".") && !moduleSpecifier.startsWith("/")) continue;
          const importedFile = importDecl.getModuleSpecifierSourceFile();
          if (!importedFile) continue;
          const importedPath = relative4(rootPath, importedFile.getFilePath());
          this.trackNamedImports(importDecl, importedPath, relativePath, symbolUsages);
          this.trackDefaultImport(importDecl, importedPath, relativePath, symbolUsages);
          this.trackNamespaceImport(importDecl, importedPath, relativePath, symbolUsages);
        }
      }
    );
  }
  trackNamedImports(importDecl, importedPath, relativePath, symbolUsages) {
    const namedImports = importDecl.getNamedImports();
    for (const namedImport of namedImports) {
      const importName = namedImport.getName();
      const key = `${importedPath}::${importName}`;
      const usage = symbolUsages.get(key);
      if (usage) {
        usage.usedInFiles.add(relativePath);
        usage.usageCount++;
      }
    }
  }
  trackDefaultImport(importDecl, importedPath, relativePath, symbolUsages) {
    const defaultImport = importDecl.getDefaultImport();
    if (defaultImport) {
      const key = `${importedPath}::default`;
      const usage = symbolUsages.get(key);
      if (usage) {
        usage.usedInFiles.add(relativePath);
        usage.usageCount++;
      }
    }
  }
  /**
   * Track namespace imports (import * as name)
   * These indicate heavy coupling to a module's entire API
   */
  trackNamespaceImport(importDecl, importedPath, relativePath, symbolUsages) {
    const namespaceImport = importDecl.getNamespaceImport();
    if (namespaceImport) {
      const key = `${importedPath}::*`;
      if (!symbolUsages.has(key)) {
        symbolUsages.set(key, {
          name: "*",
          usedInFiles: /* @__PURE__ */ new Set(),
          usageCount: 0
        });
      }
      const usage = symbolUsages.get(key);
      usage.usedInFiles.add(relativePath);
      usage.usageCount++;
    }
  }
  generateViolations(symbolUsages, threshold) {
    const violations = [];
    for (const [key, usage] of symbolUsages.entries()) {
      const fileCount = usage.usedInFiles.size;
      if (fileCount >= threshold) {
        const [filePath, symbolName] = key.split("::");
        const fileList = Array.from(usage.usedInFiles).slice(0, 5).join(", ");
        violations.push(createViolation({
          rule: "Shotgun Surgery",
          severity: this.getSeverityByFileCount(fileCount),
          message: `Symbol '${symbolName}' from ${filePath} is used in ${fileCount} files: ${fileList}${fileCount > 5 ? "..." : ""}`,
          file: filePath,
          line: 1,
          impact: "Changes to this symbol require modifying many files, increasing risk and maintenance cost",
          suggestedFix: `Consider:
  1. Introducing a facade or wrapper to reduce direct coupling
  2. Using dependency injection to centralize usage
  3. Extracting shared behavior into a base class or mixin
  4. Evaluating if this is truly shared logic or duplicated code
  5. Creating a higher-level abstraction that encapsulates this logic`,
          penalty: this.calculatePenalty(fileCount, threshold)
        }));
      }
    }
    return violations;
  }
  getSeverityByFileCount(count) {
    if (count >= 10) return "warning";
    return "info";
  }
  calculatePenalty(count, threshold) {
    return Math.min(10, 6 + Math.floor((count - threshold) / 2));
  }
};

// src/rules/duplicate-code.rule.ts
var CRITICAL_PENALTY = 2;
var WARNING_PENALTY = 1;
var INFO_PENALTY = 0.5;
var MIN_DUPLICATE_LINES = 5;
var CRITICAL_FILE_COUNT_THRESHOLD = 5;
var WARNING_FILE_COUNT_THRESHOLD = 3;
var DuplicateCodeRule = class {
  name = "duplicate-code";
  severity = "warning";
  penalty = INFO_PENALTY;
  minLines = MIN_DUPLICATE_LINES;
  check(context) {
    const sourceFiles = context.project.getSourceFiles();
    const ruleConfig = context.config.rules?.[this.name];
    let minLines = this.minLines;
    if (ruleConfig && typeof ruleConfig === "object" && "minLines" in ruleConfig) {
      const configMinLines = ruleConfig.minLines;
      if (typeof configMinLines === "number") {
        minLines = configMinLines;
      }
    }
    const codeBlocks = this.collectCodeBlocks(sourceFiles, context.rootPath, minLines);
    return this.generateViolations(codeBlocks);
  }
  collectCodeBlocks(sourceFiles, rootPath, minLines) {
    const codeBlocks = /* @__PURE__ */ new Map();
    processSourceFiles(
      sourceFiles,
      rootPath,
      (sourceFile, _, relativePath) => {
        const lines = sourceFile.getFullText().split("\n");
        for (let i = 0; i <= lines.length - minLines; i++) {
          const block = lines.slice(i, i + minLines);
          const normalized = this.normalizeCode(block);
          if (this.isInsignificant(normalized)) {
            continue;
          }
          const hash = this.hashCode(normalized);
          if (!codeBlocks.has(hash)) {
            codeBlocks.set(hash, []);
          }
          codeBlocks.get(hash).push({
            file: relativePath,
            line: i + 1,
            code: block.join("\n")
          });
        }
      },
      { skipTests: true }
    );
    return codeBlocks;
  }
  generateViolations(codeBlocks) {
    const violations = [];
    for (const [_hash, locations] of codeBlocks.entries()) {
      if (locations.length < 2) continue;
      const uniqueFiles = this.getUniqueFiles(locations);
      if (uniqueFiles.size < 2) continue;
      const violation = this.createDuplicateViolation(uniqueFiles);
      violations.push(violation);
    }
    return violations;
  }
  getUniqueFiles(locations) {
    const uniqueFiles = /* @__PURE__ */ new Map();
    for (const loc of locations) {
      if (!uniqueFiles.has(loc.file)) {
        uniqueFiles.set(loc.file, { line: loc.line, code: loc.code });
      }
    }
    return uniqueFiles;
  }
  createDuplicateViolation(uniqueFiles) {
    const files = Array.from(uniqueFiles.keys());
    const filesList = files.slice(0, 3).join(", ") + (files.length > 3 ? `, ... (${files.length} files)` : "");
    const { severity, penalty } = this.calculateSeverityAndPenalty(uniqueFiles.size);
    const firstFile = files[0];
    const firstOcc = uniqueFiles.get(firstFile);
    return createViolation({
      rule: "Duplicate Code",
      severity,
      message: `Code duplicated in ${uniqueFiles.size} files: ${filesList}`,
      file: firstFile,
      line: firstOcc.line,
      impact: "Increases maintenance burden and risk of inconsistencies",
      suggestedFix: "Extract common logic into a shared function, class, or component",
      penalty
    });
  }
  calculateSeverityAndPenalty(fileCount) {
    if (fileCount >= CRITICAL_FILE_COUNT_THRESHOLD) {
      return { severity: "critical", penalty: CRITICAL_PENALTY };
    }
    if (fileCount >= WARNING_FILE_COUNT_THRESHOLD) {
      return { severity: "warning", penalty: WARNING_PENALTY };
    }
    return { severity: "info", penalty: INFO_PENALTY };
  }
  normalizeCode(lines) {
    return lines.map((line) => line.trim()).filter((line) => line.length > 0).join("");
  }
  isInsignificant(normalized) {
    if (normalized.length < 10) return true;
    if (normalized.startsWith("import") || normalized.startsWith("export")) return true;
    if (normalized.startsWith("//") || normalized.startsWith("/*")) return true;
    if (/^[}\])]+$/.test(normalized)) return true;
    return false;
  }
  /**
   * Generate hash using DJB2 algorithm for better collision resistance
   * @param s String to hash
   * @returns Hexadecimal hash string
   */
  hashCode(s) {
    let hash = 5381;
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i);
      hash = (hash << 5) + hash + char;
      hash = hash >>> 0;
    }
    return hash.toString(16);
  }
};

// src/rules/unused-exports.rule.ts
var UnusedExportsRule = class {
  name = "unused-exports";
  severity = "info";
  penalty = 1;
  check(context) {
    const { project, config, rootPath } = context;
    const sourceFiles = project.getSourceFiles();
    const excludePatterns = config.rules?.[this.name]?.excludePatterns || [
      "index.ts",
      "index.tsx",
      "public-api.ts",
      "api.ts",
      ".d.ts"
    ];
    const exportMap = this.collectExports(sourceFiles, rootPath, excludePatterns);
    const importedNames = this.collectImports(sourceFiles);
    return this.findUnusedExports(exportMap, importedNames, sourceFiles, rootPath);
  }
  collectExports(sourceFiles, rootPath, excludePatterns) {
    const exportMap = /* @__PURE__ */ new Map();
    processSourceFiles(
      sourceFiles,
      rootPath,
      (sourceFile, filePath, relativePath) => {
        if (excludePatterns.some((pattern) => relativePath.includes(pattern))) return;
        const exports = /* @__PURE__ */ new Map();
        const exportedDeclarations = sourceFile.getExportedDeclarations();
        for (const [name, declarations] of exportedDeclarations) {
          if (declarations.length > 0) {
            const line = declarations[0].getStartLineNumber();
            exports.set(name, { line, filePath });
          }
        }
        if (exports.size > 0) {
          exportMap.set(relativePath, exports);
        }
      }
    );
    return exportMap;
  }
  collectImports(sourceFiles) {
    const importedNames = /* @__PURE__ */ new Map();
    for (const sourceFile of sourceFiles) {
      if (sourceFile.getFilePath().includes("node_modules")) continue;
      const imports = sourceFile.getImportDeclarations();
      for (const importDecl of imports) {
        const namedImports = importDecl.getNamedImports();
        for (const namedImport of namedImports) {
          const name = namedImport.getName();
          importedNames.set(name, (importedNames.get(name) || 0) + 1);
        }
        const defaultImport = importDecl.getDefaultImport();
        if (defaultImport) {
          const name = defaultImport.getText();
          importedNames.set(name, (importedNames.get(name) || 0) + 1);
        }
      }
    }
    return importedNames;
  }
  findUnusedExports(exportMap, importedNames, sourceFiles, rootPath) {
    const violations = [];
    for (const [relativePath, exports] of exportMap.entries()) {
      const sourceFile = sourceFiles.find((sf) => {
        const sfPath = sf.getFilePath().replace(rootPath + "/", "");
        return sfPath === relativePath;
      });
      for (const [exportName, { line }] of exports) {
        if (exportName === "default") continue;
        const importCount = importedNames.get(exportName) || 0;
        let usedLocally = false;
        if (sourceFile && importCount === 0) {
          usedLocally = this.checkLocalUsage(sourceFile, exportName);
        }
        if (importCount === 0 && !usedLocally) {
          violations.push(createViolation({
            rule: "Unused Export",
            severity: "info",
            message: `Export '${exportName}' is never imported`,
            file: relativePath,
            line,
            impact: "Dead code that increases maintenance burden and may confuse developers",
            suggestedFix: `Remove the export if truly unused. If it's part of a public API, document it. If it's used externally, add it to exclusion patterns in config.`,
            penalty: 4
          }));
        }
      }
    }
    return violations;
  }
  checkLocalUsage(sourceFile, exportName) {
    const declarations = sourceFile.getExportedDeclarations().get(exportName);
    if (!declarations || declarations.length === 0) return false;
    const declaration = declarations[0];
    if (declaration.getKindName() === "TypeAliasDeclaration" || declaration.getKindName() === "InterfaceDeclaration") {
      const fileText = sourceFile.getFullText();
      const typeUsagePattern = new RegExp(`(:|extends|implements|as)\\s*${exportName}\\b|<\\s*${exportName}\\s*>`, "g");
      const matches = fileText.match(typeUsagePattern);
      return matches ? matches.length > 0 : false;
    } else {
      const hasReferences = (node) => {
        return "findReferencesAsNodes" in node && typeof node.findReferencesAsNodes === "function";
      };
      if (hasReferences(declaration)) {
        const references = declaration.findReferencesAsNodes();
        return references.length > 1;
      }
    }
    return false;
  }
};

// src/rules/dead-code.rule.ts
import { Node as Node4, SyntaxKind as SyntaxKind4 } from "ts-morph";
var DeadCodeRule = class {
  name = "dead-code";
  severity = "info";
  penalty = 4;
  check(context) {
    const { project, rootPath } = context;
    const violations = [];
    processSourceFiles(
      project.getSourceFiles(),
      rootPath,
      (sourceFile, filePath, _) => {
        this.checkUnreachableAfterReturn(sourceFile, filePath, violations);
        this.checkUnusedVariables(sourceFile, filePath, violations);
      }
    );
    return violations;
  }
  checkUnreachableAfterReturn(sourceFile, filePath, violations) {
    const functions = [
      ...sourceFile.getFunctions(),
      ...sourceFile.getClasses().flatMap((cls) => cls.getMethods())
    ];
    for (const func of functions) {
      const body = func.getBody();
      if (!body || !Node4.isBlock(body)) continue;
      const statements = body.getStatements();
      for (let i = 0; i < statements.length - 1; i++) {
        const statement = statements[i];
        if (this.isExitStatement(statement)) {
          const nextStatement = statements[i + 1];
          const functionName = "getName" in func ? func.getName() : "<anonymous>";
          violations.push(createViolation({
            rule: "Dead Code",
            severity: "info",
            message: `Unreachable code after ${statement.getKindName().toLowerCase()} in '${functionName}'`,
            file: filePath,
            line: nextStatement.getStartLineNumber(),
            impact: "Dead code increases maintenance burden and confuses developers",
            suggestedFix: "Remove unreachable code or restructure logic to make it reachable",
            penalty: 4
          }));
          break;
        }
      }
    }
  }
  checkUnusedVariables(sourceFile, filePath, violations) {
    const variableStatements = sourceFile.getVariableStatements();
    for (const stmt of variableStatements) {
      if (stmt.isExported()) continue;
      const declarations = stmt.getDeclarations();
      this.checkDeclarationsForUnusedVariables(declarations, filePath, sourceFile, violations);
    }
  }
  checkDeclarationsForUnusedVariables(declarations, filePath, sourceFile, violations) {
    for (const decl of declarations) {
      const name = decl.getName();
      if (this.shouldSkipVariable(name)) continue;
      const references = decl.findReferencesAsNodes();
      if (references.length !== 1) continue;
      const fileText = sourceFile.getFullText();
      if (this.isVariableUsed(name, fileText)) continue;
      violations.push(createViolation({
        rule: "Dead Code",
        severity: "info",
        message: `Variable '${name}' is declared but never used`,
        file: filePath,
        line: decl.getStartLineNumber(),
        impact: "Unused variables add clutter and may indicate incomplete refactoring",
        suggestedFix: `Remove unused variable '${name}' or use it in the code`,
        penalty: 2
      }));
    }
  }
  shouldSkipVariable(name) {
    return name.includes("{") || name.includes("[");
  }
  isVariableUsed(name, fileText) {
    const usagePattern = new RegExp(`\\b${name}\\b`, "g");
    const matches = fileText.match(usagePattern);
    if (matches && matches.length > 1) return true;
    const variableUsagePattern = new RegExp(`\\[\\s*${name}\\s*\\]|\\[\\s*['"\`]${name}['"\`]\\s*\\]|${name}\\s*\\[`, "g");
    if (variableUsagePattern.test(fileText)) return true;
    const contextPattern = new RegExp(`[:{,]\\s*${name}\\b|\\(${name}\\)|<${name}>`, "g");
    return contextPattern.test(fileText);
  }
  isExitStatement(statement) {
    const kind = statement.getKind();
    return kind === SyntaxKind4.ReturnStatement || kind === SyntaxKind4.ThrowStatement;
  }
};

// src/core/analyzer.ts
var Analyzer = class {
  rules = [
    // === CORE ARCHITECTURE RULES (Critical) ===
    new CircularDepsRule(),
    new LayerViolationRule(),
    new ForbiddenImportsRule(),
    // === COUPLING & COMPLEXITY ANALYSIS ===
    new TooManyImportsRule(),
    new CyclomaticComplexityRule(),
    new DeepNestingRule(),
    new LargeFunctionRule(),
    new MaxFileLinesRule(),
    // === DESIGN PATTERN & API QUALITY ===
    new LongParameterListRule(),
    new DataClumpsRule(),
    new ShotgunSurgeryRule(),
    // === CODE HEALTH ===
    new DuplicateCodeRule(),
    new UnusedExportsRule(),
    new DeadCodeRule()
  ];
  projectLoader = new ProjectLoader();
  graphBuilder = new GraphBuilder();
  scoreCalculator = new ScoreCalculator();
  riskRanker = new RiskRanker();
  async analyze(config) {
    const projectContext = await this.projectLoader.load(config);
    const project = this.projectLoader.getProject();
    const graph = this.graphBuilder.build(project, projectContext.rootPath);
    const { violations, errors } = this.runRules(project, graph, config, projectContext.rootPath);
    const sourceFiles = project.getSourceFiles().filter((sf) => !sf.getFilePath().includes("node_modules"));
    const actualModuleCount = sourceFiles.length;
    const totalLOC = sourceFiles.reduce((sum, sf) => {
      return sum + sf.getEndLineNumber();
    }, 0);
    const counts = this.riskRanker.countBySeverity(violations);
    const { score, status, breakdown } = this.scoreCalculator.calculate(
      violations,
      actualModuleCount,
      totalLOC
    );
    const topRisks = this.riskRanker.rank(violations, 5);
    const violatedFiles = new Set(violations.map((v) => v.file));
    const healthyModuleCount = Math.max(0, actualModuleCount - violatedFiles.size);
    const projectName = this.getProjectName(projectContext.rootPath);
    const result = {
      violations,
      score,
      status,
      criticalCount: counts.critical,
      warningCount: counts.warning,
      infoCount: counts.info,
      healthyModuleCount,
      totalModules: actualModuleCount,
      topRisks,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      projectName,
      scoreBreakdown: breakdown,
      totalLOC
    };
    if (errors.length > 0) {
      result.ruleErrors = errors;
    }
    return result;
  }
  getProjectName(rootPath) {
    try {
      const packageJsonPath = join(rootPath, "package.json");
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
        if (packageJson.name) {
          return packageJson.name;
        }
      }
    } catch (error) {
    }
    return basename(rootPath);
  }
  runRules(project, graph, config, rootPath) {
    const allViolations = [];
    const ruleErrors = [];
    const context = createRuleContext(project, graph, config, rootPath);
    for (const rule of this.rules) {
      try {
        const violations = rule.check(context);
        allViolations.push(...violations);
      } catch (error) {
        const ruleError = this.createRuleError(rule.name, error);
        ruleErrors.push(ruleError);
        this.logRuleError(rule.name, error);
      }
    }
    return { violations: allViolations, errors: ruleErrors };
  }
  createRuleError(ruleName, error) {
    return {
      ruleName,
      error: error instanceof Error ? error : new Error(String(error)),
      stack: error instanceof Error ? error.stack : void 0
    };
  }
  logRuleError(ruleName, error) {
    console.error(`
\u26A0\uFE0F  Error in rule "${ruleName}":`);
    console.error(error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    console.error("");
  }
};

// src/output/terminal-reporter.ts
import pc8 from "picocolors";

// src/output/utils/violation-utils.ts
function groupViolationsByType(violations) {
  const grouped = {};
  for (const violation of violations) {
    if (!grouped[violation.rule]) {
      grouped[violation.rule] = [];
    }
    grouped[violation.rule].push(violation);
  }
  return grouped;
}
function getFileName(filePath) {
  return filePath.split("/").pop() || filePath;
}

// src/output/formatters.ts
import pc from "picocolors";
function getSeverityIcon(severity) {
  switch (severity) {
    case "critical":
      return "\u{1F6A8}";
    case "warning":
      return "\u26A0\uFE0F";
    case "info":
      return "\u2139\uFE0F";
    default:
      return "\u2022";
  }
}
function getSeverityColor(severity) {
  switch (severity) {
    case "critical":
      return pc.red;
    case "warning":
      return pc.yellow;
    case "info":
      return pc.blue;
    default:
      return pc.white;
  }
}
function getStatusIcon(status) {
  switch (status) {
    case "Excellent":
      return "\u2728";
    case "Healthy":
      return "\u2705";
    case "Needs Attention":
      return "\u26A0\uFE0F";
    case "Critical":
      return "\u{1F6A8}";
    default:
      return "\u2022";
  }
}
function getStatusColor(status) {
  switch (status) {
    case "Excellent":
      return pc.green;
    case "Healthy":
      return pc.cyan;
    case "Needs Attention":
      return pc.yellow;
    case "Critical":
      return pc.red;
    default:
      return pc.white;
  }
}
function getScoreColor(score) {
  if (score >= 90) return pc.green;
  if (score >= 75) return pc.cyan;
  if (score >= 60) return pc.yellow;
  return pc.red;
}
function getScoreBar(score) {
  const filled = Math.floor(score / 10);
  const empty = 10 - filled;
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);
  if (score >= 90) return pc.green(bar);
  if (score >= 75) return pc.cyan(bar);
  if (score >= 60) return pc.yellow(bar);
  return pc.red(bar);
}
function formatPriority(priority) {
  switch (priority) {
    case "HIGH":
      return pc.red(pc.bold(priority));
    case "MEDIUM":
      return pc.yellow(pc.bold(priority));
    case "LOW":
      return pc.green(pc.bold(priority));
    default:
      return pc.dim(priority);
  }
}
function getRiskColor(level) {
  switch (level) {
    case "HIGH":
      return pc.red;
    case "MEDIUM":
      return pc.yellow;
    case "LOW":
      return pc.cyan;
    default:
      return pc.green;
  }
}
function wrapText(text, width) {
  const lines = text.split("\n");
  return lines.map((line) => {
    if (line.length <= width) return line;
    const words = line.split(" ");
    const wrapped = [];
    let currentLine = "";
    for (const word of words) {
      if ((currentLine + " " + word).trim().length <= width) {
        currentLine = currentLine ? `${currentLine} ${word}` : word;
      } else {
        if (currentLine) wrapped.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) wrapped.push(currentLine);
    return wrapped.join("\n");
  }).join("\n");
}
function getFileName2(filePath) {
  return filePath.split("/").pop() || filePath;
}

// src/output/summaries/structure-violations.ts
import pc2 from "picocolors";
function printGodFileSummary(violations) {
  const sortedBySize = violations.map((v) => ({
    file: v.file,
    lines: parseInt(v.message.match(/(\d+) lines/)?.[1] || "0")
  })).sort((a, b) => b.lines - a.lines);
  console.log(pc2.dim("  Impact: ") + "Reduces code maintainability and increases cognitive load");
  console.log();
  console.log(pc2.dim("  Files:"));
  sortedBySize.forEach((item, idx) => {
    const fileName = item.file.split("/").pop() || item.file;
    console.log(`    ${pc2.yellow(idx + 1 + ".")} ${fileName} ${pc2.dim(`\u2014 ${item.lines} lines`)}`);
  });
  console.log();
  console.log(pc2.bold("  \u{1F4A1} Suggested Fix:"));
  console.log("     Split large files into focused modules (classes, utilities, types).");
  console.log("     Target: Keep files under 500 lines for better maintainability.");
}
function printCircularDepSummary(violations) {
  console.log(pc2.dim("  Impact: ") + pc2.red("HIGH") + " \u2014 Prevents proper modularization, causes initialization issues");
  console.log();
  console.log(pc2.dim("  Detected cycles:"));
  violations.forEach((v, idx) => {
    const cycle = `${v.file} \u2194 ${v.relatedFile}`;
    console.log(`    ${pc2.red(idx + 1 + ".")} ${pc2.dim(cycle)}`);
  });
  console.log();
  console.log(pc2.bold("  \u{1F4A1} Suggested Fix:"));
  console.log("     \u2022 Extract shared code into a new module");
  console.log("     \u2022 Use dependency injection");
  console.log("     \u2022 Introduce abstraction/interface layer");
}
function printLayerViolationSummary(violations) {
  console.log(pc2.dim("  Impact: ") + "Breaks architectural boundaries and separation of concerns");
  console.log();
  console.log(pc2.dim("  Architectural violations:"));
  violations.forEach((v, idx) => {
    const layerMatch = v.message.match(/(\w+) layer importing from (\w+) layer/);
    if (layerMatch) {
      const [, fromLayer, toLayer] = layerMatch;
      console.log(`    ${pc2.yellow(idx + 1 + ".")} ${fromLayer} \u2192 ${toLayer} ${pc2.dim(`\u2014 ${v.file}`)}`);
    } else {
      console.log(`    ${pc2.yellow(idx + 1 + ".")} ${v.file} \u2192 ${v.relatedFile || "unknown"}`);
    }
  });
  console.log();
  console.log(pc2.bold("  \u{1F4A1} Suggested Fix:"));
  console.log("     Respect layer hierarchy and use dependency inversion.");
  console.log("     Move shared logic to allowed layers or use interfaces.");
}
function printForbiddenImportSummary(violations) {
  console.log(pc2.dim("  Impact: ") + "Introduces unwanted dependencies and coupling");
  console.log();
  console.log(pc2.dim("  Forbidden imports detected:"));
  violations.forEach((v, idx) => {
    const importMatch = v.message.match(/Importing "([^"]+)"/);
    const importName = importMatch ? importMatch[1] : "unknown";
    console.log(`    ${pc2.yellow(idx + 1 + ".")} ${importName} ${pc2.dim(`\u2014 in ${v.file}`)}`);
  });
  console.log();
  console.log(pc2.bold("  \u{1F4A1} Suggested Fix:"));
  console.log("     Remove forbidden imports or restructure code.");
  console.log("     Use dependency injection or refactor to avoid coupling.");
}

// src/output/summaries/quality-violations.ts
import pc4 from "picocolors";

// src/output/summaries/summary-helpers.ts
import pc3 from "picocolors";
function formatFileLocation(violation) {
  return violation.line ? `${violation.file}:${violation.line}` : violation.file;
}
function printImpact(impact) {
  console.log(pc3.dim("  Impact: ") + impact);
  console.log();
}
function printSuggestedFix(suggestions) {
  console.log();
  console.log(pc3.bold("  \u{1F4A1} Suggested Fix:"));
  suggestions.forEach((suggestion) => {
    console.log(`     ${suggestion}`);
  });
}
function printNumberedList(title, items, color = "yellow") {
  console.log(pc3.dim(`  ${title}:`));
  items.forEach((item, idx) => {
    const number = pc3[color](idx + 1 + ".");
    const line = item.secondary ? `    ${number} ${item.primary} ${pc3.dim(`\u2014 ${item.secondary}`)}` : `    ${number} ${item.primary}`;
    console.log(line);
  });
}
function printSummaryStats(label, value, details) {
  console.log(`    ${pc3.yellow(label + ":")} ${value}${details ? ` ${pc3.dim(details)}` : ""}`);
}
function extractTotalFromMessages(violations, pattern) {
  return violations.reduce((sum, v) => {
    const match = v.message.match(pattern);
    return sum + (match ? parseInt(match[1]) : 0);
  }, 0);
}

// src/output/summaries/quality-violations.ts
function printMissingTestsSummary(violations) {
  printImpact("Reduces confidence in code changes and increases regression risk");
  const items = violations.map((v) => ({ primary: getFileName(v.file) }));
  printNumberedList("Untested files", items);
  printSuggestedFix([
    "Create corresponding .spec.ts files with unit tests.",
    "Target: at least 80% code coverage for critical logic."
  ]);
}
function printSkippedTestsSummary(violations) {
  const byFile = violations.reduce((acc, v) => {
    const fileName = v.file.split("/").pop() || v.file;
    if (!acc[fileName]) acc[fileName] = [];
    acc[fileName].push(v);
    return acc;
  }, {});
  printImpact("Reduces test coverage reliability, may hide broken functionality");
  const items = Object.keys(byFile).map((fileName) => {
    const count = byFile[fileName].length;
    return {
      primary: fileName,
      secondary: `${count} skipped test${count === 1 ? "" : "s"}`
    };
  });
  printNumberedList("Skipped tests by file", items);
  printSuggestedFix([
    "Unskip and fix failing tests. Remove obsolete tests.",
    "Add issue tracker references for deferred work."
  ]);
}
function printMissingTypeAnnotationsSummary(violations) {
  const totalMissing = extractTotalFromMessages(violations, /^(\d+) missing/);
  printImpact("Reduces type safety, IntelliSense quality, and code documentation");
  console.log(pc4.dim("  Missing type annotations:"));
  printSummaryStats("Total", `${totalMissing} annotations across ${violations.length} ${violations.length === 1 ? "file" : "files"}`);
  console.log();
  const sortedByCount = violations.map((v) => ({
    file: v.file,
    count: parseInt(v.message.match(/^(\d+) missing/)?.[1] || "0")
  })).sort((a, b) => b.count - a.count);
  const items = sortedByCount.map((item) => ({
    primary: getFileName(item.file),
    secondary: `${item.count} missing`
  }));
  printNumberedList("Files with most missing annotations", items, "cyan");
  printSuggestedFix([
    "Add explicit type annotations to parameters and return types.",
    "Use TypeScript strict mode. Enable noImplicitAny in tsconfig."
  ]);
}
function printUnusedExportsSummary(violations) {
  console.log(pc4.dim("  Impact: ") + "Dead code that increases maintenance burden and may confuse developers");
  console.log();
  console.log(pc4.dim("  Unused exports:"));
  violations.forEach((v, idx) => {
    const fileName = getFileName(v.file);
    const exportName = v.message.match(/Export '([^']+)'/)?.[1] || "unknown";
    console.log(`    ${pc4.cyan(idx + 1 + ".")} ${exportName} ${pc4.dim(`in ${fileName}`)}`);
  });
  console.log();
  console.log(pc4.bold("  \u{1F4A1} Suggested Fix:"));
  console.log("     Remove unused exports or document if part of public API.");
  console.log("     Add to exclusion patterns if used externally.");
}
function printDeadCodeSummary(violations) {
  const unreachable = violations.filter((v) => v.message.includes("Unreachable"));
  const unused = violations.filter((v) => v.message.includes("never used"));
  console.log(pc4.dim("  Impact: ") + "Increases codebase size and confuses developers");
  console.log();
  if (unreachable.length > 0) {
    console.log(pc4.dim("  Unreachable code:"));
    unreachable.forEach((v, idx) => {
      const fileName = getFileName(v.file);
      const match = v.message.match(/in '([^']+)'/);
      const functionName = match ? match[1] : "unknown";
      console.log(`    ${pc4.yellow(idx + 1 + ".")} ${functionName} ${pc4.dim(`in ${fileName}`)}`);
    });
    console.log();
  }
  if (unused.length > 0) {
    console.log(pc4.dim("  Unused variables:"));
    unused.forEach((v, idx) => {
      const fileName = getFileName(v.file);
      const match = v.message.match(/Variable '([^']+)'/);
      const varName = match ? match[1] : "unknown";
      console.log(`    ${pc4.cyan(idx + 1 + ".")} ${varName} ${pc4.dim(`in ${fileName}`)}`);
    });
    console.log();
  }
  console.log(pc4.bold("  \u{1F4A1} Suggested Fix:"));
  console.log("     Remove dead code. Use IDE refactoring tools to safely delete.");
  console.log("     Enable strict TypeScript settings to catch unused code.");
}

// src/output/summaries/complexity-violations.ts
import pc5 from "picocolors";
function printCyclomaticComplexitySummary(violations) {
  const sortedByComplexity = violations.map((v) => ({
    file: v.file,
    functionName: v.message.match(/(?:Function|Method|Arrow function) '([^']+)'/)?.[1] || "unknown",
    complexity: parseInt(v.message.match(/complexity of (\d+)/)?.[1] || "0")
  })).sort((a, b) => b.complexity - a.complexity);
  console.log(pc5.dim("  Impact: ") + "High complexity increases bug probability and makes code harder to test");
  console.log();
  console.log(pc5.dim("  Most complex functions:"));
  sortedByComplexity.forEach((item, idx) => {
    const fileName = item.file.split("/").pop() || item.file;
    console.log(`    ${pc5.red(idx + 1 + ".")} ${item.functionName} ${pc5.dim(`in ${fileName} \u2014 complexity ${item.complexity}`)}`);
  });
  console.log();
  console.log(pc5.bold("  \u{1F4A1} Suggested Fix:"));
  console.log("     Break down into smaller functions. Extract conditionals.");
  console.log("     Use early returns, strategy pattern, or lookup tables.");
}
function printDeepNestingSummary(violations) {
  const sortedByDepth = violations.map((v) => ({
    file: v.file,
    functionName: v.message.match(/(?:Function|Method|Arrow function) '([^']+)'/)?.[1] || "unknown",
    depth: parseInt(v.message.match(/depth of (\d+) levels/)?.[1] || "0")
  })).sort((a, b) => b.depth - a.depth);
  console.log(pc5.dim("  Impact: ") + "Increases cyclomatic complexity, reduces readability and testability");
  console.log();
  console.log(pc5.dim("  Most deeply nested functions:"));
  sortedByDepth.forEach((item, idx) => {
    const fileName = item.file.split("/").pop() || item.file;
    console.log(`    ${pc5.yellow(idx + 1 + ".")} ${item.functionName} ${pc5.dim(`in ${fileName} \u2014 ${item.depth} levels deep`)}`);
  });
  console.log();
  console.log(pc5.bold("  \u{1F4A1} Suggested Fix:"));
  console.log("     Use early returns/guard clauses to reduce nesting.");
  console.log("     Extract nested blocks into separate helper methods.");
}
function printLargeFunctionSummary(violations) {
  const sortedBySize = violations.map((v) => ({
    file: v.file,
    functionName: v.message.match(/(?:Function|Method|Arrow function) '([^']+)'/)?.[1] || "unknown",
    lines: parseInt(v.message.match(/(\d+) lines/)?.[1] || "0")
  })).sort((a, b) => b.lines - a.lines);
  console.log(pc5.dim("  Impact: ") + "Reduces testability, code comprehension, and maintainability");
  console.log();
  console.log(pc5.dim("  Largest functions:"));
  sortedBySize.forEach((item, idx) => {
    const fileName = item.file.split("/").pop() || item.file;
    console.log(`    ${pc5.yellow(idx + 1 + ".")} ${item.functionName} ${pc5.dim(`in ${fileName} \u2014 ${item.lines} lines`)}`);
  });
  console.log();
  console.log(pc5.bold("  \u{1F4A1} Suggested Fix:"));
  console.log("     Split large functions into smaller helper functions.");
  console.log("     Extract complex logic into well-named private methods.");
}
function printLongParameterListSummary(violations) {
  const sortedByCount = violations.map((v) => ({
    file: v.file,
    functionName: v.message.match(/(?:Function|Method|Arrow function) '([^']+)'/)?.[1] || "unknown",
    count: parseInt(v.message.match(/has (\d+) parameters/)?.[1] || "0")
  })).sort((a, b) => b.count - a.count);
  console.log(pc5.dim("  Impact: ") + "Reduces readability, increases testing complexity");
  console.log();
  console.log(pc5.dim("  Functions with most parameters:"));
  sortedByCount.forEach((item, idx) => {
    const fileName = item.file.split("/").pop() || item.file;
    console.log(`    ${pc5.yellow(idx + 1 + ".")} ${item.functionName} ${pc5.dim(`in ${fileName} \u2014 ${item.count} params`)}`);
  });
  console.log();
  console.log(pc5.bold("  \u{1F4A1} Suggested Fix:"));
  console.log("     Use parameter objects to group related parameters.");
  console.log("     Apply builder pattern for complex construction.");
}
function printTooManyImportsSummary(violations) {
  const sortedByCount = violations.map((v) => ({
    file: v.file,
    count: parseInt(v.message.match(/(\d+) imports/)?.[1] || "0")
  })).sort((a, b) => b.count - a.count);
  console.log(pc5.dim("  Impact: ") + "Increases coupling, reduces modularity, violates Single Responsibility");
  console.log();
  console.log(pc5.dim("  Files with excessive imports:"));
  sortedByCount.forEach((item, idx) => {
    const fileName = item.file.split("/").pop() || item.file;
    console.log(`    ${pc5.yellow(idx + 1 + ".")} ${fileName} ${pc5.dim(`\u2014 ${item.count} imports`)}`);
  });
  console.log();
  console.log(pc5.bold("  \u{1F4A1} Suggested Fix:"));
  console.log("     Refactor into smaller, focused modules.");
  console.log("     Remove unused imports. Use facade pattern to reduce dependencies.");
}

// src/output/summaries/code-smell-violations.ts
import pc6 from "picocolors";
function printFeatureEnvySummary(violations) {
  console.log(pc6.dim("  Impact: ") + "Violates encapsulation and creates tight coupling");
  console.log();
  console.log(pc6.dim("  Methods envying other classes:"));
  violations.forEach((v, idx) => {
    const fileName = v.file.split("/").pop() || v.file;
    const methodMatch = v.message.match(/Method '([^']+)'/);
    const objectMatch = v.message.match(/uses '([^']+)'/);
    const method = methodMatch ? methodMatch[1] : "unknown";
    const enviedObject = objectMatch ? objectMatch[1] : "unknown";
    console.log(`    ${pc6.yellow(idx + 1 + ".")} ${method} ${pc6.dim(`envies ${enviedObject} \u2014 in ${fileName}`)}`);
  });
  console.log();
  console.log(pc6.bold("  \u{1F4A1} Suggested Fix:"));
  console.log("     Move method to the envied class or extract shared logic.");
  console.log("     Use Tell, Don't Ask principle to improve encapsulation.");
}
function printDataClumpsSummary(violations) {
  console.log(pc6.dim("  Impact: ") + "Indicates missing abstraction, makes refactoring error-prone");
  console.log();
  console.log(pc6.dim("  Parameter groups appearing together:"));
  violations.forEach((v, idx) => {
    const paramsMatch = v.message.match(/\[([^\]]+)\]/);
    const countMatch = v.message.match(/appears (\d+) times/);
    const params = paramsMatch ? paramsMatch[1] : "unknown";
    const count = countMatch ? countMatch[1] : "?";
    console.log(`    ${pc6.yellow(idx + 1 + ".")} [${params}] ${pc6.dim(`\u2014 ${count} occurrences`)}`);
  });
  console.log();
  console.log(pc6.bold("  \u{1F4A1} Suggested Fix:"));
  console.log("     Extract parameter groups into interfaces or classes.");
  console.log("     Create cohesive types that represent domain concepts.");
}
function printShotgunSurgerySummary(violations) {
  const sortedByFileCount = violations.map((v) => ({
    file: v.file,
    symbol: v.message.match(/Symbol '([^']+)'/)?.[1] || "unknown",
    fileCount: parseInt(v.message.match(/used in (\d+) files/)?.[1] || "0")
  })).sort((a, b) => b.fileCount - a.fileCount);
  console.log(pc6.dim("  Impact: ") + "Changes require modifying many files, increasing risk");
  console.log();
  console.log(pc6.dim("  Symbols with widest usage:"));
  sortedByFileCount.forEach((item, idx) => {
    const fileName = item.file.split("/").pop() || item.file;
    console.log(`    ${pc6.red(idx + 1 + ".")} ${item.symbol} ${pc6.dim(`from ${fileName} \u2014 ${item.fileCount} files`)}`);
  });
  console.log();
  console.log(pc6.bold("  \u{1F4A1} Suggested Fix:"));
  console.log("     Introduce facade or wrapper to reduce direct coupling.");
  console.log("     Use dependency injection to centralize usage.");
}
function printDuplicateCodeSummary(violations) {
  const groupedByFiles = /* @__PURE__ */ new Map();
  violations.forEach((v) => {
    const files = v.message.match(/files: (.+)$/)?.[1] || "unknown";
    if (!groupedByFiles.has(files)) {
      groupedByFiles.set(files, []);
    }
    groupedByFiles.get(files).push(v);
  });
  console.log(pc6.dim("  Impact: ") + "Increases maintenance burden and bug probability");
  console.log();
  console.log(pc6.dim(`  ${groupedByFiles.size} unique duplicate patterns found:`));
  let idx = 1;
  for (const [files, dupes] of groupedByFiles.entries()) {
    const fileCount = dupes[0].message.match(/duplicated in (\d+) files/)?.[1] || "?";
    const blockCount = dupes.length;
    console.log(`    ${pc6.yellow(idx + ".")} ${blockCount} block${blockCount > 1 ? "s" : ""} duplicated in ${fileCount} files ${pc6.dim(`\u2014 ${files}`)}`);
    idx++;
  }
  console.log();
  console.log(pc6.bold("  \u{1F4A1} Suggested Fix:"));
  console.log("     Extract into shared utility functions or classes.");
  console.log("     Use inheritance, composition, or Template Method pattern.");
}

// src/output/summaries/style-violations.ts
import pc7 from "picocolors";
function printMagicNumbersSummary(violations) {
  const sortedByOccurrences = violations.map((v) => ({
    file: v.file,
    number: v.message.match(/Number '([^']+)'/)?.[1] || "unknown",
    count: parseInt(v.message.match(/appears (\d+) times/)?.[1] || "0")
  })).sort((a, b) => b.count - a.count);
  printImpact("Reduces code clarity and maintainability, makes changes error-prone");
  const items = sortedByOccurrences.map((item) => ({
    primary: `${item.number} ${pc7.dim(`in ${getFileName(item.file)}`)}`,
    secondary: `${item.count} occurrences`
  }));
  printNumberedList("Most repeated magic numbers", items);
  printSuggestedFix([
    "Extract into named constants with descriptive names.",
    "Use enums for related constants. Move to config for thresholds."
  ]);
}
function printWildcardImportsSummary(violations) {
  printImpact("Increases bundle size and reduces tree-shaking effectiveness");
  const items = violations.map((v) => {
    const fileName = getFileName(v.file);
    const match = v.message.match(/import \* as (\w+) from '([^']+)'/);
    const alias = match?.[1] || "unknown";
    const module = match?.[2] || "unknown";
    return {
      primary: fileName,
      secondary: `import * as ${alias} from '${module}'`
    };
  });
  printNumberedList("Wildcard imports detected", items, "cyan");
  printSuggestedFix([
    "Replace with named imports for only what you need.",
    "Enables better tree-shaking and makes dependencies explicit."
  ]);
}
function printTodoCommentsSummary(violations) {
  const totalMarkers = extractTotalFromMessages(violations, /^(\d+) technical/);
  const MARKER_TYPES = ["TODO", "FIXME", "HACK", "XXX"];
  const byType = violations.reduce((acc, v) => {
    const message = v.message;
    for (const type of MARKER_TYPES) {
      const pattern = new RegExp(`(\\d+) ${type}s?`);
      const match = message.match(pattern);
      if (match) {
        acc[type] = (acc[type] || 0) + parseInt(match[1]);
      }
    }
    return acc;
  }, {});
  printImpact("Indicates incomplete work, known issues, or deferred improvements");
  console.log(pc7.dim("  Technical debt markers:"));
  printSummaryStats("Total", `${totalMarkers} markers across ${violations.length} ${violations.length === 1 ? "file" : "files"}`);
  const breakdown = Object.entries(byType).map(([type, count]) => `${count} ${type}${count > 1 ? "s" : ""}`).join(", ");
  if (breakdown) {
    console.log(`    ${pc7.dim("Breakdown:")} ${breakdown}`);
  }
  console.log();
  console.log(pc7.dim("  Files with most markers:"));
  const sortedByCount = violations.map((v) => ({
    file: v.file,
    count: parseInt(v.message.match(/^(\d+) technical/)?.[1] || "0")
  })).sort((a, b) => b.count - a.count);
  sortedByCount.forEach((item, idx) => {
    const fileName = getFileName(item.file);
    console.log(`    ${pc7.yellow(idx + 1 + ".")} ${fileName} ${pc7.dim(`\u2014 ${item.count} markers`)}`);
  });
  console.log();
  console.log(pc7.bold("  \u{1F4A1} Suggested Fix:"));
  console.log("     Review markers: complete TODOs, fix FIXMEs, refactor HACKs.");
  console.log("     Create tracked issues for deferred work. Remove obsolete markers.");
}
function printGenericViolationSummary(violations) {
  console.log(pc7.dim("  Impact: ") + violations[0].impact);
  console.log();
  console.log(pc7.dim("  Violations:"));
  violations.forEach((v, idx) => {
    const fileLocation = formatFileLocation(v);
    const location = v.relatedFile ? `${fileLocation} \u2192 ${v.relatedFile}` : fileLocation;
    console.log(`    ${idx + 1 + "."} ${pc7.dim(location)}`);
  });
  console.log();
  console.log(pc7.bold("  \u{1F4A1} Suggested Fix:"));
  console.log("     " + violations[0].suggestedFix.split("\n")[0]);
}

// src/output/action-generators.ts
function generateCircularDependencyActions(violations) {
  return violations.map((v) => {
    const files = v.relatedFile ? `${getFileName2(v.file)} \u2194 ${getFileName2(v.relatedFile)}` : getFileName2(v.file);
    return {
      description: `Resolve circular dependency: ${files}`,
      priority: "HIGH",
      effort: "2-4h",
      impact: "Improves testability and reduces coupling"
    };
  });
}
function generateLayerViolationActions(violations) {
  return violations.map((v) => {
    const files = v.relatedFile ? `${getFileName2(v.file)} \u2192 ${getFileName2(v.relatedFile)}` : getFileName2(v.file);
    return {
      description: `Fix layer violation: ${files}`,
      priority: "HIGH",
      effort: "1-2h",
      impact: "Maintains architectural boundaries"
    };
  });
}
function generateGodFileActions(violations) {
  const godFiles = violations.map((v) => ({
    violation: v,
    file: v.file,
    fileName: getFileName2(v.file),
    lines: parseInt(v.message.match(/(\d+) lines/)?.[1] || "0")
  })).sort((a, b) => b.lines - a.lines);
  return godFiles.map((item) => {
    let priority;
    let effort;
    let impact;
    if (item.lines > 1e3) {
      priority = "HIGH";
      effort = "4-8h";
      impact = "Significantly improves maintainability";
    } else if (item.lines > 750) {
      priority = "MEDIUM";
      effort = "2-4h";
      impact = "Improves modularity and code organization";
    } else {
      priority = "LOW";
      effort = "1-2h";
      impact = "Minor maintainability improvement";
    }
    return {
      description: `Refactor oversized file: ${item.fileName} (${item.lines} lines)`,
      priority,
      effort,
      impact,
      file: item.file,
      line: 1
    };
  });
}
function generateTooManyImportsActions(violations) {
  const topViolations = violations.map((v) => ({
    violation: v,
    file: v.file,
    fileName: getFileName2(v.file),
    count: parseInt(v.message.match(/(\d+) imports/)?.[1] || "0")
  })).sort((a, b) => b.count - a.count).slice(0, 3);
  return topViolations.map((item) => ({
    description: `Refactor high coupling: ${item.fileName} (${item.count} imports)`,
    priority: "HIGH",
    effort: "4-8h",
    impact: "Reduces coupling and improves modularity",
    file: item.file,
    line: 1
  }));
}
function generateLargeFunctionActions(violations) {
  const topFunctions = violations.map((v) => ({
    violation: v,
    file: v.file,
    name: v.message.match(/(?:Function|Method|Arrow function) '(.+?)'/)?.[1] || v.message.match(/'(.+?)'/)?.[1] || getFileName2(v.file),
    lines: parseInt(v.message.match(/(\d+) lines/)?.[1] || "0")
  })).sort((a, b) => b.lines - a.lines).slice(0, 3);
  return topFunctions.map((item) => {
    let priority;
    let effort;
    let impact;
    if (item.lines > 200) {
      priority = "HIGH";
      effort = "4-6h";
      impact = "Significantly improves testability and comprehension";
    } else if (item.lines > 100) {
      priority = "MEDIUM";
      effort = "2-4h";
      impact = "Improves maintainability and reduces complexity";
    } else {
      priority = "LOW";
      effort = "1-2h";
      impact = "Minor maintainability improvement";
    }
    return {
      description: `Refactor large function: ${item.name} in ${getFileName2(item.file)} (${item.lines} lines)`,
      priority,
      effort,
      impact,
      file: item.file,
      line: item.violation.line
    };
  });
}
function generateDeepNestingActions(violations) {
  const topViolations = violations.map((v) => ({
    violation: v,
    file: v.file,
    name: v.message.match(/(?:Function|Method|Arrow function) '(.+?)'/)?.[1] || v.message.match(/'(.+?)'/)?.[1] || getFileName2(v.file),
    depth: parseInt(v.message.match(/(\d+) levels/)?.[1] || "0")
  })).sort((a, b) => b.depth - a.depth).slice(0, 5);
  return topViolations.map((item) => {
    let priority;
    let effort;
    if (item.depth > 10) {
      priority = "HIGH";
      effort = "3-5h";
    } else if (item.depth > 6) {
      priority = "MEDIUM";
      effort = "2-3h";
    } else {
      priority = "LOW";
      effort = "1-2h";
    }
    return {
      description: `Reduce nesting in ${item.name} (${getFileName2(item.file)}) \u2014 ${item.depth} levels`,
      priority,
      effort,
      impact: "Reduces complexity and improves readability",
      file: item.file,
      line: item.violation.line
    };
  });
}
function createTestCoverageAction(violations) {
  const count = violations.length;
  return {
    description: `Add test coverage for ${count} untested files`,
    priority: "MEDIUM",
    effort: `${count}-${count * 3}h`,
    impact: "Reduces regression risk and increases code confidence"
  };
}
function createSkippedTestAction(violations) {
  const count = violations.length;
  return {
    description: `Unskip and fix ${count} skipped tests`,
    priority: "MEDIUM",
    effort: `${count}-${count * 2}h`,
    impact: "Improves test coverage and reliability"
  };
}
function createMagicNumberAction(violations) {
  const uniqueNumbers = new Set(violations.map((v) => v.message.match(/Number (\S+)/)?.[1])).size;
  return {
    description: `Extract ${uniqueNumbers} magic numbers into named constants`,
    priority: "LOW",
    effort: "4-8h",
    impact: "Improves code clarity and maintainability"
  };
}
function createTypeAnnotationAction(violations) {
  const count = violations.length;
  const fileCount = new Set(violations.map((v) => v.file)).size;
  return {
    description: `Add ${count} missing type annotations across ${fileCount} files`,
    priority: "MEDIUM",
    effort: "3-5h",
    impact: "Improves type safety and IDE support"
  };
}
function generateBulkActions(violations, type) {
  const count = violations.length;
  if (count === 0) return [];
  const actionFactories = {
    "Missing Test File": createTestCoverageAction,
    "Skipped Test": createSkippedTestAction,
    "Magic Number": createMagicNumberAction,
    "Missing Type Annotation": createTypeAnnotationAction
  };
  const simpleActions = {
    "Technical Debt Marker": {
      description: `Address ${count} technical debt marker(s) (TODO/FIXME/HACK)`,
      priority: "LOW",
      effort: "1-2h",
      impact: "Resolves deferred work and reduces technical debt"
    },
    "Unused Export": {
      description: `Clean up ${count} unused exports`,
      priority: "MEDIUM",
      effort: `${Math.ceil(count / 2)}-${count}h`,
      impact: "Reduces dead code and clarifies public API"
    },
    "Wildcard Import": {
      description: `Replace ${count} wildcard imports with explicit imports`,
      priority: "LOW",
      effort: "1-2h",
      impact: "Improves tree-shaking and reduces bundle size"
    }
  };
  const actionConfig = actionFactories[type]?.(violations) ?? simpleActions[type];
  if (!actionConfig) return [];
  return [{
    description: actionConfig.description,
    priority: actionConfig.priority,
    effort: actionConfig.effort,
    impact: actionConfig.impact
  }];
}

// src/output/action-generator.ts
function generateNextActions(result) {
  const actions = [];
  const grouped = groupViolationsByType(result.violations);
  if (grouped["Circular Dependency"]) {
    actions.push(...generateCircularDependencyActions(grouped["Circular Dependency"]));
  }
  if (grouped["Layer Violation"]) {
    actions.push(...generateLayerViolationActions(grouped["Layer Violation"]));
  }
  if (grouped["Too Many Imports"]) {
    actions.push(...generateTooManyImportsActions(grouped["Too Many Imports"]));
  }
  if (grouped["Large Function"]) {
    actions.push(...generateLargeFunctionActions(grouped["Large Function"]));
  }
  if (grouped["Deep Nesting"]) {
    actions.push(...generateDeepNestingActions(grouped["Deep Nesting"]));
  }
  if (grouped["God File"]) {
    actions.push(...generateGodFileActions(grouped["God File"]));
  }
  const bulkActionTypes = [
    "Missing Test File",
    "Skipped Test",
    "Technical Debt Marker",
    "Unused Export",
    "Missing Type Annotation",
    "Magic Number",
    "Wildcard Import"
  ];
  bulkActionTypes.forEach((type) => {
    if (grouped[type]) {
      actions.push(...generateBulkActions(grouped[type], type));
    }
  });
  return sortActionsByPriority(actions);
}
function sortActionsByPriority(actions) {
  if (actions.length === 0) {
    return [{
      description: "Continue maintaining current architecture standards",
      priority: "LOW",
      effort: "Ongoing"
    }];
  }
  const priorityOrder = { "HIGH": 1, "MEDIUM": 2, "LOW": 3 };
  return actions.sort((a, b) => {
    const aPriority = priorityOrder[a.priority] || 99;
    const bPriority = priorityOrder[b.priority] || 99;
    return aPriority - bPriority;
  });
}

// src/output/terminal-reporter.ts
var SEPARATOR_WIDTH = 54;
var SUMMARY_PRINTERS = {
  "God File": printGodFileSummary,
  "Circular Dependency": printCircularDepSummary,
  "Missing Test File": printMissingTestsSummary,
  "Too Many Imports": printTooManyImportsSummary,
  "Large Function": printLargeFunctionSummary,
  "Deep Nesting": printDeepNestingSummary,
  "Skipped Test": printSkippedTestsSummary,
  "Magic Number": printMagicNumbersSummary,
  "Wildcard Import": printWildcardImportsSummary,
  "Technical Debt Marker": printTodoCommentsSummary,
  "Unused Export": printUnusedExportsSummary,
  "Missing Type Annotation": printMissingTypeAnnotationsSummary,
  "High Cyclomatic Complexity": printCyclomaticComplexitySummary,
  "Duplicate Code": printDuplicateCodeSummary,
  "Layer Violation": printLayerViolationSummary,
  "Forbidden Import": printForbiddenImportSummary,
  "Dead Code": printDeadCodeSummary,
  "Long Parameter List": printLongParameterListSummary,
  "Feature Envy": printFeatureEnvySummary,
  "Data Clump": printDataClumpsSummary,
  "Shotgun Surgery": printShotgunSurgerySummary
};
var TerminalReporter = class {
  report(result, verbose) {
    console.log();
    this.printHeader(result.projectName);
    console.log();
    this.printExecutiveSummary(result);
    console.log();
    this.printProjectStats(result);
    console.log();
    if (result.violations.length > 0) {
      this.printGroupedRisks(result);
      console.log();
      this.printNextActions(result);
      console.log();
    } else {
      this.printNoIssuesMessage();
      console.log();
    }
    if (verbose && result.violations.length > 0) {
      this.printDetailedViolations(result.violations);
      console.log();
    }
  }
  printHeader(projectName) {
    console.log(pc8.bold(pc8.cyan("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501")));
    if (projectName) {
      console.log(pc8.bold(pc8.cyan(`  ARCHGUARD \u2014 Analyzing ${pc8.white(projectName)}`)));
    } else {
      console.log(pc8.bold(pc8.cyan("  ARCHGUARD \u2014 Architecture Analysis Report")));
    }
    console.log(pc8.bold(pc8.cyan("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501")));
  }
  printExecutiveSummary(result) {
    console.log(pc8.bold("\u{1F4CA} EXECUTIVE SUMMARY"));
    console.log(pc8.dim("\u2500".repeat(SEPARATOR_WIDTH)));
    console.log();
    const scoreColor = getScoreColor(result.score);
    const scoreBar = getScoreBar(result.score);
    console.log(`  Architecture Score: ${scoreColor(pc8.bold(result.score.toString()))} / 100  ${scoreBar}`);
    const statusIcon = getStatusIcon(result.status);
    const statusColor = getStatusColor(result.status);
    console.log(`  Health Status:      ${statusColor(`${statusIcon} ${result.status}`)}`);
    const riskLevel = this.getRiskLevel(result);
    const riskColor = getRiskColor(riskLevel);
    console.log(`  Risk Level:         ${riskColor(riskLevel)}`);
    if (result.violations.length > 0) {
      const primaryConcern = this.getPrimaryConcern(result);
      console.log(`  Primary Concern:    ${pc8.yellow(primaryConcern)}`);
    } else {
      console.log(`  Primary Concern:    ${pc8.green("None \u2014 Excellent architecture!")}`);
    }
    if (result.scoreBreakdown) {
      console.log();
      this.printCategoryBreakdown(result);
    }
  }
  printCategoryBreakdown(result) {
    if (!result.scoreBreakdown) return;
    const { structural, design, complexity, hygiene } = result.scoreBreakdown;
    console.log(pc8.dim("  Category Breakdown:"));
    console.log();
    const structuralIcon = this.getCategoryIcon(structural.impact);
    console.log(`    ${structuralIcon} Structural:   ${this.formatCategoryLine(structural)}`);
    const designIcon = this.getCategoryIcon(design.impact);
    console.log(`    ${designIcon} Design:       ${this.formatCategoryLine(design)}`);
    const complexityIcon = this.getCategoryIcon(complexity.impact);
    console.log(`    ${complexityIcon} Complexity:   ${this.formatCategoryLine(complexity)}`);
    const hygieneIcon = this.getCategoryIcon(hygiene.impact);
    console.log(`    ${hygieneIcon} Hygiene:      ${this.formatCategoryLine(hygiene)}`);
  }
  getCategoryIcon(impact) {
    if (impact === "HIGH") return pc8.red("\u{1F534}");
    if (impact === "MEDIUM") return pc8.yellow("\u26A0\uFE0F ");
    return pc8.blue("\u2139\uFE0F ");
  }
  formatCategoryLine(category) {
    const count = pc8.dim(`${category.violations} issues`);
    const penalty = category.penalty > 0 ? pc8.red(`-${category.penalty.toFixed(1)} pts`) : pc8.green("0 pts");
    const impact = this.formatImpact(category.impact);
    return `${count.padEnd(20)} ${penalty.padEnd(20)} ${impact}`;
  }
  formatImpact(impact) {
    if (impact === "HIGH") return pc8.red("HIGH IMPACT");
    if (impact === "MEDIUM") return pc8.yellow("MEDIUM");
    return pc8.dim("LOW");
  }
  printProjectStats(result) {
    console.log(pc8.bold("\u{1F4C8} PROJECT STATISTICS"));
    console.log(pc8.dim("\u2500".repeat(SEPARATOR_WIDTH)));
    console.log();
    const grouped = groupViolationsByType(result.violations);
    this.printModuleStatistics(result);
    if (result.totalLOC) {
      console.log(`  Total Lines of Code:   ${pc8.cyan(result.totalLOC.toLocaleString())}`);
    }
    this.printArchitectureViolations(grouped);
    this.printGodFileDetails(grouped);
  }
  printModuleStatistics(result) {
    console.log(`  Files Analyzed:        ${pc8.bold(result.totalModules.toString())}`);
    const healthyPercent = Math.round(result.healthyModuleCount / result.totalModules * 100);
    console.log(`  Healthy Modules:       ${pc8.green(`${result.healthyModuleCount} / ${result.totalModules}`)} ${pc8.dim(`(${healthyPercent}%)`)}`);
    console.log();
  }
  printArchitectureViolations(grouped) {
    const circularCount = grouped["Circular Dependency"]?.length || 0;
    const layerCount = grouped["Layer Violation"]?.length || 0;
    const godFileCount = grouped["God File"]?.length || 0;
    const forbiddenCount = grouped["Forbidden Import"]?.length || 0;
    console.log(`  Circular Dependencies: ${this.formatCountDisplay(circularCount)}`);
    console.log(`  Layer Violations:      ${this.formatCountDisplay(layerCount)}`);
    console.log(`  God Files:             ${godFileCount > 0 ? this.formatWarningDisplay(godFileCount) + " \u26A0\uFE0F" : pc8.green("0 \u2705")}`);
    console.log(`  Forbidden Imports:     ${this.formatWarningDisplay(forbiddenCount)}`);
  }
  printGodFileDetails(grouped) {
    const godFileCount = grouped["God File"]?.length || 0;
    if (godFileCount === 0) return;
    const largestFile = this.getLargestFile(grouped["God File"] || []);
    if (largestFile) {
      console.log(`  Largest File:          ${pc8.yellow(largestFile)}`);
    }
    const avgSize = this.getAverageFileSize(grouped["God File"] || []);
    if (avgSize) {
      console.log(`  Average File Size:     ${avgSize}`);
    }
  }
  formatCountDisplay(count) {
    if (count === 0) return pc8.green("0 \u2705");
    return pc8.red(count.toString());
  }
  formatWarningDisplay(count) {
    if (count === 0) return pc8.green("0 \u2705");
    return pc8.yellow(count.toString());
  }
  printNoIssuesMessage() {
    console.log(pc8.bold(pc8.green("\u2728 EXCELLENT!")));
    console.log(pc8.dim("\u2500".repeat(SEPARATOR_WIDTH)));
    console.log();
    console.log(pc8.green("  No architecture violations detected!"));
    console.log(pc8.dim("  Your codebase follows architectural best practices."));
  }
  printGroupedRisks(result) {
    console.log(pc8.bold("\u{1F3AF} RISK BREAKDOWN"));
    console.log(pc8.dim("\u2500".repeat(SEPARATOR_WIDTH)));
    console.log();
    const grouped = groupViolationsByType(result.violations);
    const sortedTypes = Object.keys(grouped).sort((a, b) => {
      const aWeight = this.getSeverityWeight(grouped[a][0].severity);
      const bWeight = this.getSeverityWeight(grouped[b][0].severity);
      return bWeight - aWeight;
    });
    for (const type of sortedTypes) {
      this.printGroupedViolationType(type, grouped[type]);
    }
  }
  printGroupedViolationType(type, violations) {
    const icon = getSeverityIcon(violations[0].severity);
    const color = getSeverityColor(violations[0].severity);
    console.log(color(`  ${icon} ${type.toUpperCase()} (${violations.length})`));
    console.log(pc8.dim("  " + "\u2500".repeat(52)));
    const printer = SUMMARY_PRINTERS[type] || printGenericViolationSummary;
    printer(violations);
    console.log();
  }
  printNextActions(result) {
    console.log(pc8.bold("\u{1F527} RECOMMENDED ACTIONS"));
    console.log(pc8.dim("\u2500".repeat(SEPARATOR_WIDTH)));
    console.log();
    const actions = generateNextActions(result);
    actions.forEach((action, idx) => {
      console.log(`  ${pc8.cyan(idx + 1 + ".")} ${action.description}`);
      console.log(`     ${pc8.dim("Priority:")} ${formatPriority(action.priority)} ${pc8.dim("\u2502")} ${pc8.dim("Effort:")} ${action.effort}`);
      if (action.impact) {
        console.log(`     ${pc8.dim("Impact:")} ${action.impact}`);
      }
      if (action.file) {
        const linkText = action.line ? `${action.file}:${action.line}` : action.file;
        console.log(`     ${pc8.dim("File:")} ${pc8.blue(linkText)}`);
      }
      console.log();
    });
    console.log(pc8.dim("  \u{1F4A1} Tip: Address high-priority items first for maximum impact."));
  }
  printDetailedViolations(violations) {
    console.log(pc8.bold("\u{1F4CB} DETAILED VIOLATION LIST"));
    console.log(pc8.dim("\u2500".repeat(SEPARATOR_WIDTH)));
    console.log();
    for (const violation of violations) {
      this.printViolation(violation, true);
      console.log(pc8.dim("\u2500".repeat(SEPARATOR_WIDTH)));
      console.log();
    }
  }
  printViolation(violation, detailed) {
    const icon = getSeverityIcon(violation.severity);
    const color = getSeverityColor(violation.severity);
    console.log(color(`${icon} ${violation.rule.toUpperCase()}`));
    const fileLocation = violation.line ? `${violation.file}:${violation.line}` : violation.file;
    console.log(pc8.dim(fileLocation));
    if (violation.relatedFile) {
      console.log(pc8.dim("   \u2193 imports"));
      console.log(pc8.dim(violation.relatedFile));
    }
    console.log();
    console.log(pc8.dim(violation.message));
    if (detailed) {
      console.log();
      console.log(pc8.bold("Why this matters:"));
      console.log(wrapText(violation.impact, 50));
      console.log();
      console.log(pc8.bold("Suggested fix:"));
      console.log(pc8.green(wrapText(violation.suggestedFix, 50)));
    }
  }
  // Helper methods
  getRiskLevel(result) {
    if (result.criticalCount > 0) return "HIGH";
    if (result.warningCount > 5) return "MEDIUM";
    if (result.warningCount > 0) return "LOW";
    return "MINIMAL";
  }
  getPrimaryConcern(result) {
    const grouped = groupViolationsByType(result.violations);
    const primaryConcern = this.findPrimaryConcernByPriority(grouped);
    if (primaryConcern) return primaryConcern;
    return this.getMostCommonConcern(grouped);
  }
  findPrimaryConcernByPriority(grouped) {
    const concernConfigs = this.getConcernConfigurations();
    for (const config of concernConfigs) {
      const violations = grouped[config.type];
      if (violations && violations.length > 0) {
        return config.format(violations.length);
      }
    }
    return null;
  }
  getConcernConfigurations() {
    return [
      {
        type: "Circular Dependency",
        format: (count) => `Circular dependencies \u2014 ${count} cycle${count === 1 ? "" : "s"} detected`
      },
      {
        type: "Layer Violation",
        format: (count) => `Architectural boundaries \u2014 ${count} layer ${count === 1 ? "violation" : "violations"}`
      },
      {
        type: "Forbidden Import",
        format: (count) => `Import restrictions \u2014 ${count} forbidden ${count === 1 ? "import" : "imports"}`
      },
      {
        type: "God File",
        format: () => "File modularity \u2014 oversized source and test files"
      },
      {
        type: "Duplicate Code",
        format: (count) => `Code duplication \u2014 ${count} duplicate ${count === 1 ? "block" : "blocks"} found`
      },
      {
        type: "High Cyclomatic Complexity",
        format: (count) => `Code complexity \u2014 ${count} overly complex ${count === 1 ? "function" : "functions"}`
      },
      {
        type: "Large Function",
        format: (count) => `Function size \u2014 ${count} oversized ${count === 1 ? "function" : "functions"}`
      },
      {
        type: "Dead Code",
        format: (count) => `Dead code \u2014 ${count} unused ${count === 1 ? "element" : "elements"}`
      }
    ];
  }
  getMostCommonConcern(grouped) {
    const sortedTypes = Object.keys(grouped).sort(
      (a, b) => grouped[b].length - grouped[a].length
    );
    if (sortedTypes.length === 0) {
      return "None";
    }
    const primaryType = sortedTypes[0];
    const count = grouped[primaryType].length;
    return `${primaryType} \u2014 ${count} ${count === 1 ? "issue" : "issues"}`;
  }
  getLargestFile(violations) {
    if (violations.length === 0) return null;
    const largest = violations.map((v) => ({
      file: v.file,
      lines: parseInt(v.message.match(/(\d+) lines/)?.[1] || "0")
    })).sort((a, b) => b.lines - a.lines)[0];
    const fileName = largest.file.split("/").pop() || largest.file;
    return `${fileName} (${largest.lines} lines)`;
  }
  getAverageFileSize(violations) {
    if (violations.length === 0) return null;
    const sizes = violations.map(
      (v) => parseInt(v.message.match(/(\d+) lines/)?.[1] || "0")
    );
    const avg = Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length);
    const maxScale = 1500;
    const filled = Math.min(10, Math.floor(avg / maxScale * 10));
    const empty = 10 - filled;
    const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);
    return `${avg} lines ${pc8.dim(bar)}`;
  }
  getSeverityWeight(severity) {
    switch (severity) {
      case "critical":
        return 3;
      case "warning":
        return 2;
      case "info":
        return 1;
      default:
        return 0;
    }
  }
};

// src/output/json-reporter.ts
var JsonReporter = class {
  report(result, _verbose) {
    const output = {
      score: result.score,
      status: result.status,
      timestamp: result.timestamp,
      summary: {
        critical: result.criticalCount,
        warnings: result.warningCount,
        info: result.infoCount,
        healthyModules: result.healthyModuleCount,
        totalModules: result.totalModules
      },
      topRisks: result.topRisks.map((v) => ({
        rule: v.rule,
        severity: v.severity,
        file: v.file,
        relatedFile: v.relatedFile,
        line: v.line,
        message: v.message,
        impact: v.impact,
        suggestedFix: v.suggestedFix
      })),
      violations: result.violations.map((v) => ({
        rule: v.rule,
        severity: v.severity,
        file: v.file,
        relatedFile: v.relatedFile,
        line: v.line,
        message: v.message
      }))
    };
    console.log(JSON.stringify(output, null, 2));
  }
};

// src/output/executive-reporter.ts
import pc9 from "picocolors";
var ExecutiveReporter = class _ExecutiveReporter {
  static REPORT_WIDTH = 78;
  static PADDING_WITH_BORDER = 92;
  static PADDING_WITH_ICONS = 90;
  static TOP_CRITICAL_LIMIT = 5;
  static TOP_WARNINGS_LIMIT = 3;
  static TOP_RULES_LIMIT = 3;
  static SCORE_IMPROVEMENT_TARGET = 15;
  static PENALTY_IMPROVEMENT_FACTOR = 0.6;
  scoreCalculator = new ScoreCalculator();
  report(result, _) {
    console.log();
    this.printExecutiveHeader(result);
    console.log();
    this.printArchitectureScore(result);
    console.log();
    if (result.violations.length > 0) {
      this.printCriticalIssues(result);
      console.log();
      this.printImmediateActions(result);
    } else {
      this.printExcellenceMessage();
    }
    console.log();
  }
  printExecutiveHeader(result) {
    const border = "\u2550".repeat(_ExecutiveReporter.REPORT_WIDTH);
    console.log(pc9.cyan(border));
    console.log(pc9.bold(pc9.cyan("  ARCHGUARD \u2014 EXECUTIVE ARCHITECTURE REPORT")));
    if (result.projectName) {
      console.log(pc9.cyan(`  Project: ${pc9.white(result.projectName)}`));
    }
    const date = new Date(result.timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    console.log(pc9.dim(`  Analysis Date: ${date}`));
    console.log(pc9.cyan(border));
  }
  printArchitectureScore(result) {
    const grade = this.scoreCalculator.getGrade(result.score);
    const scoreColor = getScoreColor(result.score);
    const statusIcon = getStatusIcon(result.status);
    const statusColor = getStatusColor(result.status);
    console.log(pc9.bold("\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510"));
    console.log(pc9.bold(`\u2502  ARCHITECTURE HEALTH SCORE: ${scoreColor(pc9.bold(result.score.toString()))} / 100  [${grade}]`).padEnd(_ExecutiveReporter.PADDING_WITH_BORDER) + pc9.bold("\u2502"));
    console.log(pc9.bold("\u2502                                                                         \u2502"));
    console.log(pc9.bold(`\u2502  Status: ${statusColor(`${statusIcon} ${result.status}`)}`.padEnd(_ExecutiveReporter.PADDING_WITH_BORDER)) + pc9.bold("\u2502"));
    if (result.scoreBreakdown) {
      console.log(pc9.bold("\u2502                                                                         \u2502"));
      console.log(pc9.bold("\u2502  Risk Breakdown:                                                        \u2502"));
      const { structural, design, complexity, hygiene } = result.scoreBreakdown;
      if (structural.violations > 0) {
        const impact = structural.impact === "HIGH" ? pc9.red("HIGH RISK") : structural.impact;
        console.log(pc9.bold(`\u2502    \u{1F534} Structural:  ${structural.violations} issues  -${structural.penalty.toFixed(1)} pts  ${impact}`.padEnd(_ExecutiveReporter.PADDING_WITH_ICONS)) + pc9.bold("\u2502"));
      }
      if (design.violations > 0) {
        const impact = design.impact === "HIGH" ? pc9.yellow("MEDIUM RISK") : design.impact;
        console.log(pc9.bold(`\u2502    \u26A0\uFE0F  Design:      ${design.violations} issues  -${design.penalty.toFixed(1)} pts  ${impact}`.padEnd(_ExecutiveReporter.PADDING_WITH_ICONS)) + pc9.bold("\u2502"));
      }
      if (complexity.violations > 0) {
        console.log(pc9.bold(`\u2502    \u2139\uFE0F  Complexity:  ${complexity.violations} issues  -${complexity.penalty.toFixed(1)} pts`.padEnd(_ExecutiveReporter.PADDING_WITH_ICONS)) + pc9.bold("\u2502"));
      }
      if (hygiene.violations > 0) {
        console.log(pc9.bold(`\u2502    \u{1F9F9} Hygiene:     ${hygiene.violations} issues  -${hygiene.penalty.toFixed(1)} pts`.padEnd(_ExecutiveReporter.PADDING_WITH_ICONS)) + pc9.bold("\u2502"));
      }
    }
    console.log(pc9.bold("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518"));
  }
  printCriticalIssues(result) {
    const criticalViolations = result.violations.filter((v) => v.severity === "critical");
    if (criticalViolations.length === 0) {
      console.log(pc9.bold("\u{1F3AF} CRITICAL ISSUES"));
      console.log(pc9.dim("\u2500".repeat(_ExecutiveReporter.REPORT_WIDTH)));
      console.log();
      console.log(pc9.green("  \u2713 No critical architectural issues detected"));
      return;
    }
    console.log(pc9.bold(pc9.red("\u26D4 IMMEDIATE ACTION REQUIRED")));
    console.log(pc9.dim("\u2500".repeat(_ExecutiveReporter.REPORT_WIDTH)));
    console.log();
    console.log(pc9.red(`  ${criticalViolations.length} CRITICAL architectural issues detected`));
    console.log();
    const topCritical = criticalViolations.slice(0, _ExecutiveReporter.TOP_CRITICAL_LIMIT);
    topCritical.forEach((violation, index) => {
      console.log(pc9.bold(`  ${index + 1}. ${pc9.red(getSeverityIcon(violation.severity))} ${violation.rule}`));
      console.log(pc9.dim(`     Location: ${violation.file}${violation.line ? `:${violation.line}` : ""}`));
      if (violation.relatedFile) {
        console.log(pc9.dim(`     Related:  ${violation.relatedFile}`));
      }
      console.log();
      console.log(pc9.yellow(`     Impact: ${violation.impact}`));
      console.log();
    });
    if (criticalViolations.length > _ExecutiveReporter.TOP_CRITICAL_LIMIT) {
      console.log(pc9.dim(`  ... and ${criticalViolations.length - _ExecutiveReporter.TOP_CRITICAL_LIMIT} more critical issues`));
      console.log();
    }
  }
  printImmediateActions(result) {
    console.log(pc9.bold("\u{1F3AF} IMMEDIATE ACTIONS"));
    console.log(pc9.dim("\u2500".repeat(_ExecutiveReporter.REPORT_WIDTH)));
    console.log();
    const criticalViolations = result.violations.filter((v) => v.severity === "critical");
    const highWarnings = result.violations.filter((v) => v.severity === "warning").sort((a, b) => b.penalty - a.penalty).slice(0, _ExecutiveReporter.TOP_WARNINGS_LIMIT);
    if (criticalViolations.length > 0) {
      console.log(pc9.bold("  THIS SPRINT (Critical):"));
      console.log();
      const grouped = this.groupByRule(criticalViolations);
      const topRules = Object.entries(grouped).sort(([, a], [, b]) => b.length - a.length).slice(0, _ExecutiveReporter.TOP_RULES_LIMIT);
      topRules.forEach(([rule, violations], index) => {
        const estimatedEffort = this.estimateEffort(violations.length);
        console.log(`  ${index + 1}. ${pc9.red("\u2611")} Fix ${violations.length} ${rule} issue${violations.length > 1 ? "s" : ""}`);
        console.log(pc9.dim(`     Estimated effort: ${estimatedEffort}`));
        console.log(pc9.dim(`     Expected score impact: +${this.estimateScoreImprovement(violations)} points`));
        console.log();
      });
    }
    if (highWarnings.length > 0) {
      console.log(pc9.bold("  NEXT 2-4 WEEKS (High Priority):"));
      console.log();
      highWarnings.forEach((violation, index) => {
        console.log(`  ${index + 1}. ${pc9.yellow("\u2611")} Address ${violation.rule}`);
        console.log(pc9.dim(`     ${violation.file}${violation.line ? `:${violation.line}` : ""}`));
        console.log();
      });
    }
    const targetScore = Math.min(100, result.score + _ExecutiveReporter.SCORE_IMPROVEMENT_TARGET);
    console.log(pc9.dim(`  Target for next analysis: ${targetScore}/100`));
  }
  printExcellenceMessage() {
    console.log(pc9.bold(pc9.green("\u2705 ARCHITECTURAL EXCELLENCE")));
    console.log(pc9.dim("\u2500".repeat(_ExecutiveReporter.REPORT_WIDTH)));
    console.log();
    console.log(pc9.green("  Your architecture is in excellent condition."));
    console.log(pc9.green("  No critical issues detected."));
    console.log();
    console.log(pc9.dim("  Continue maintaining this high standard through:"));
    console.log(pc9.dim("  \u2022 Regular architecture reviews"));
    console.log(pc9.dim("  \u2022 Continuous monitoring of metrics"));
    console.log(pc9.dim("  \u2022 Proactive refactoring of emerging issues"));
    console.log();
  }
  groupByRule(violations) {
    const grouped = {};
    for (const violation of violations) {
      if (!grouped[violation.rule]) {
        grouped[violation.rule] = [];
      }
      grouped[violation.rule].push(violation);
    }
    return grouped;
  }
  estimateEffort(count) {
    if (count === 1) return "2-4 hours";
    if (count <= 3) return "1-2 days";
    if (count <= 5) return "2-3 days";
    if (count <= 10) return "1 week";
    return "1-2 weeks";
  }
  estimateScoreImprovement(violations) {
    const totalPenalty = violations.reduce((sum, v) => sum + v.penalty, 0);
    return Math.round(totalPenalty * _ExecutiveReporter.PENALTY_IMPROVEMENT_FACTOR);
  }
};

// src/cli/cli.ts
var cli = cac("archguard");
cli.command("[root]", "Analyze TypeScript project architecture").option("--config <path>", "Path to config file").option("--format <format>", "Output format (terminal | json | executive)", {
  default: "terminal"
}).option("--fail-on-error", "Exit with code 1 if violations exist", {
  default: false
}).option("--verbose", "Show detailed diagnostics", {
  default: false
}).action(async (root, options) => {
  try {
    const targetDir = root || process.cwd();
    const originalDir = process.cwd();
    if (root) {
      process.chdir(targetDir);
    }
    const configLoader = new ConfigLoader();
    const config = await configLoader.load(options.config);
    const analyzer = new Analyzer();
    const result = await analyzer.analyze(config);
    if (root) {
      process.chdir(originalDir);
    }
    const reporter = options.format === "json" ? new JsonReporter() : options.format === "executive" ? new ExecutiveReporter() : new TerminalReporter();
    reporter.report(result, options.verbose);
    if (result.ruleErrors && result.ruleErrors.length > 0) {
      console.error(pc10.yellow(`
\u26A0\uFE0F  Warning: ${result.ruleErrors.length} rule(s) failed during analysis:`));
      for (const err of result.ruleErrors) {
        console.error(pc10.yellow(`   - ${err.ruleName}`));
      }
      console.error(pc10.yellow("   Results may be incomplete. Use --verbose for details.\n"));
    }
    if (options.failOnError && result.violations.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(pc10.red("Error:"), error instanceof Error ? error.message : error);
    process.exit(1);
  }
});
cli.help();
cli.version("1.0.0");
cli.parse();
