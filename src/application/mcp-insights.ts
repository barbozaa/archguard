import { readFile } from 'fs/promises';
import { isAbsolute, resolve } from 'path';
import { z } from 'zod';
import type { DependencyGraph, Violation } from '@domain/types.js';
import { analyzeProjectWithGraph } from './analyze-project.js';
import { DiffAnalyzer } from './diff-analyzer.js';
import { serializeResultSummary, serializeViolation } from '@presentation/utils/violation-utils.js';
import { ConfigSchema } from '@infrastructure/config/config-schema.js';
import { RULE_EXPLANATIONS, type RuleExplanationSlug } from './rule-explanations.js';

// ---------------------------------------------------------------------------
// Violation identity (aligned with DiffAnalyzer)
// ---------------------------------------------------------------------------

export function violationIdentity(v: Pick<Violation, 'rule' | 'file' | 'message'>): string {
  return `${v.rule}::${v.file}::${v.message}`;
}

// ---------------------------------------------------------------------------
// Change neighborhood (graph-native, not lint-style)
// ---------------------------------------------------------------------------

function normalizeChangedPath(p: string): string {
  return p.replace(/\\/g, '/').trim();
}

/** 1-hop neighborhood in the dependency graph around changed files. */
export function expandChangeNeighborhood(graph: DependencyGraph, changedFiles: string[]): Set<string> {
  const changeSet = new Set(changedFiles.map(normalizeChangedPath).filter(Boolean));
  const out = new Set<string>(changeSet);
  for (const file of changeSet) {
    const node = graph.nodes.get(file);
    if (!node) continue;
    for (const dep of node.dependencies) {
      out.add(dep);
    }
    for (const dep of node.dependents) {
      out.add(dep);
    }
  }
  return out;
}

function violationTouchesFiles(v: Violation, files: Set<string>): boolean {
  if (files.has(v.file)) return true;
  if (v.relatedFile && files.has(v.relatedFile)) return true;
  return false;
}

export async function analyzeChangeImpact(
  projectPath: string,
  changedFiles: string[],
  configPath?: string,
): Promise<{
  framing: string;
  changedFiles: string[];
  neighborhoodSize: number;
  violationsDirectlyOnChangedFiles: ReturnType<typeof serializeViolation>[];
  violationsInDependencyNeighborhood: ReturnType<typeof serializeViolation>[];
  hubsTouchingNeighborhood: { modulePath: string; affectedModules: number }[];
  scoreSummary: ReturnType<typeof serializeResultSummary>;
  neighborhoodMermaid: string;
}> {
  const normalized = changedFiles.map(normalizeChangedPath).filter(Boolean);
  const { result, graph } = await analyzeProjectWithGraph(projectPath, configPath);
  const changeSet = new Set(normalized);
  const neighborhood = expandChangeNeighborhood(graph, normalized);

  const direct = result.violations.filter(v => violationTouchesFiles(v, changeSet));
  const inHood = result.violations.filter(v => violationTouchesFiles(v, neighborhood));

  const hubRank = [...graph.nodes.entries()]
    .map(([modulePath, node]) => ({
      modulePath,
      affectedModules: node.dependents.size,
    }))
    .filter(h => neighborhood.has(h.modulePath) && h.affectedModules > 0)
    .sort((a, b) => b.affectedModules - a.affectedModules)
    .slice(0, 8);

  return {
    framing:
      'Change-centric view: violations and coupling **relevant to these files** and their 1-hop import graph. ' +
      'This is not a full-repo lint pass — it answers “what does my edit touch in the architecture graph?”.',
    changedFiles: normalized,
    neighborhoodSize: neighborhood.size,
    violationsDirectlyOnChangedFiles: direct.map(serializeViolation),
    violationsInDependencyNeighborhood: inHood.map(serializeViolation),
    hubsTouchingNeighborhood: hubRank,
    scoreSummary: serializeResultSummary(result),
    neighborhoodMermaid: buildNeighborhoodMermaid(graph, neighborhood, 24),
  };
}

function buildNeighborhoodMermaid(graph: DependencyGraph, neighborhood: Set<string>, maxEdges: number): string {
  const edges: { from: string; to: string }[] = [];
  for (const from of neighborhood) {
    const node = graph.nodes.get(from);
    if (!node) continue;
    for (const to of node.dependencies) {
      if (!neighborhood.has(to)) continue;
      edges.push({ from, to });
    }
  }
  const seen = new Set<string>();
  const unique = edges.filter(e => {
    const k = `${e.from}->${e.to}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const trimmed = unique.slice(0, maxEdges);
  const id = (s: string) =>
    'm_' +
    Buffer.from(s)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .slice(0, 48);
  const lines = ['flowchart LR'];
  const nodes = new Set<string>();
  for (const e of trimmed) {
    nodes.add(e.from);
    nodes.add(e.to);
  }
  for (const n of nodes) {
    const label = n.replace(/"/g, '\\"');
    lines.push(`  ${id(n)}["${label}"]`);
  }
  for (const e of trimmed) {
    lines.push(`  ${id(e.from)} --> ${id(e.to)}`);
  }
  if (lines.length === 1) {
    lines.push('  empty["No internal edges within neighborhood"]');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Layer / package aggregate Mermaid (repo-wide summary graph)
// ---------------------------------------------------------------------------

export function topLevelBucket(file: string): string {
  const parts = file.split('/').filter(Boolean);
  if (parts.length >= 2 && parts[0] === 'src') {
    return `${parts[0]}/${parts[1]}`;
  }
  if (parts.length >= 1) return parts[0] ?? 'root';
  return 'root';
}

export function buildDependencyLayerMermaid(graph: DependencyGraph, maxEdges = 48): string {
  const edgeWeights = new Map<string, number>();
  for (const [from, node] of graph.nodes) {
    const bf = topLevelBucket(from);
    for (const to of node.dependencies) {
      const bt = topLevelBucket(to);
      if (bf === bt) continue;
      const key = `${bf}:::${bt}`;
      edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
    }
  }
  const sorted = [...edgeWeights.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxEdges);
  const nodes = new Set<string>();
  for (const [k] of sorted) {
    const [a, b] = k.split(':::');
    nodes.add(a);
    nodes.add(b);
  }
  const nid = (s: string) => 'L_' + s.replace(/[^a-zA-Z0-9]/g, '_');
  const lines = ['flowchart LR', '  %% Aggregated internal imports by top-level path (not a linter graph)'];
  for (const n of nodes) {
    lines.push(`  ${nid(n)}["${n.replace(/"/g, '\\"')}"]`);
  }
  for (const [k, w] of sorted) {
    const [a, b] = k.split(':::');
    lines.push(`  ${nid(a)} -->|"${w}"| ${nid(b)}`);
  }
  if (sorted.length === 0) {
    lines.push('  lone["No cross-bucket internal imports detected"]');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Baseline JSON (from prior `archguard --format json`)
// ---------------------------------------------------------------------------

const BaselineViolationSchema = z.object({
  rule: z.string(),
  file: z.string(),
  message: z.string(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  line: z.number().optional(),
});

const BaselineReportSchema = z.object({
  score: z.number(),
  architectureScore: z.number().optional(),
  violations: z.array(BaselineViolationSchema),
});

function baselineRowToViolation(v: z.infer<typeof BaselineViolationSchema>): Violation {
  return {
    rule: v.rule,
    severity: v.severity ?? 'info',
    message: v.message,
    file: v.file,
    line: v.line ?? 1,
    impact: '(from baseline snapshot)',
    suggestedFix: '',
    penalty: 0,
  };
}

function resolveGraphFileKey(graph: DependencyGraph, filePath: string): string | null {
  const n = normalizeChangedPath(filePath);
  if (graph.nodes.has(n)) return n;
  for (const key of graph.nodes.keys()) {
    if (key === n || key.endsWith(`/${n}`)) return key;
  }
  return null;
}

export async function compareToBaselineReport(
  projectPath: string,
  baselineReportPath: string,
  configPath?: string,
): Promise<{
  framing: string;
  baselineScore: number;
  currentScore: number;
  scoreDelta: number;
  violationsIntroducedSinceBaseline: ReturnType<typeof serializeViolation>[];
  violationsResolvedSinceBaseline: ReturnType<typeof serializeViolation>[];
  baselineViolationCount: number;
  currentViolationCount: number;
}> {
  const fullBaselinePath = isAbsolute(baselineReportPath)
    ? baselineReportPath
    : resolve(projectPath, baselineReportPath);
  const raw: unknown = JSON.parse(await readFile(fullBaselinePath, 'utf-8'));
  const parsed = BaselineReportSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      'Invalid baseline JSON. Save output from `archguard . --format json` with `score` and `violations[]` (rule, file, message).',
    );
  }
  const baseline = parsed.data;
  const { result } = await analyzeProjectWithGraph(projectPath, configPath);

  const baseKeys = new Set(baseline.violations.map(v => violationIdentity(v)));
  const headKeys = new Set(result.violations.map(v => violationIdentity(v)));

  const introduced = result.violations.filter(v => !baseKeys.has(violationIdentity(v)));
  const resolved = baseline.violations.filter(v => !headKeys.has(violationIdentity(v)));

  return {
    framing:
      'Temporal comparison vs a **saved** ArchGuard JSON report (CI artifact or local snapshot). ' +
      'Shows architectural drift, not code style.',
    baselineScore: baseline.score,
    currentScore: result.score,
    scoreDelta: result.score - baseline.score,
    violationsIntroducedSinceBaseline: introduced.map(serializeViolation),
    violationsResolvedSinceBaseline: resolved.map(v => serializeViolation(baselineRowToViolation(v))),
    baselineViolationCount: baseline.violations.length,
    currentViolationCount: result.violations.length,
  };
}

// ---------------------------------------------------------------------------
// Config validation (simulate / gate config edits)
// ---------------------------------------------------------------------------

export function validateArchguardConfigJson(configJson: string): {
  valid: boolean;
  errors?: string;
  summary?: { rulesKeys: string[]; srcDirectory?: string; tsConfigPath?: string };
} {
  let data: unknown;
  try {
    data = JSON.parse(configJson);
  } catch (e) {
    return { valid: false, errors: e instanceof Error ? e.message : String(e) };
  }
  const r = ConfigSchema.safeParse(data);
  if (!r.success) {
    return { valid: false, errors: r.error.message };
  }
  const cfg = r.data;
  const rulesKeys = Object.keys(cfg.rules ?? {});
  return {
    valid: true,
    summary: {
      rulesKeys,
      srcDirectory: cfg.srcDirectory,
      tsConfigPath: cfg.tsConfigPath,
    },
  };
}

// ---------------------------------------------------------------------------
// Rule explanation + live repo matches
// ---------------------------------------------------------------------------

export async function explainViolationWithRepoContext(
  projectPath: string,
  rule: RuleExplanationSlug,
  filePath: string,
  configPath?: string,
): Promise<{
  rule: RuleExplanationSlug;
  staticExplanation: (typeof RULE_EXPLANATIONS)[RuleExplanationSlug];
  matchingViolationsInFile: ReturnType<typeof serializeViolation>[];
  importNeighborsOneHop: { file: string; importsThisFile: string[]; thisFileImports: string[] };
}> {
  const explanation = RULE_EXPLANATIONS[rule];
  const normalized = normalizeChangedPath(filePath);
  const { result, graph } = await analyzeProjectWithGraph(projectPath, configPath);

  const normalizedRule = rule.toLowerCase().replace(/\s+/g, '-');
  const graphKey = resolveGraphFileKey(graph, normalized) ?? normalized;
  const matching = result.violations.filter(v => {
    const vr = v.rule.toLowerCase().replace(/\s+/g, '-');
    return (
      (vr === normalizedRule || v.rule === rule) &&
      (v.file === graphKey || v.file === normalized || v.file.endsWith(`/${normalized}`))
    );
  });

  const node = graph.nodes.get(graphKey);
  const importsThisFile = node ? [...node.dependents] : [];
  const thisFileImports = node ? [...node.dependencies] : [];

  return {
    rule,
    staticExplanation: explanation,
    matchingViolationsInFile: matching.map(serializeViolation),
    importNeighborsOneHop: {
      file: graphKey,
      importsThisFile,
      thisFileImports,
    },
  };
}

// ---------------------------------------------------------------------------
// Role-aware “senior review” summary
// ---------------------------------------------------------------------------

export async function buildArchitectureReviewSummary(
  projectPath: string,
  options?: { baseBranch?: string; configPath?: string },
): Promise<{
  framing: string;
  forAuthor: string[];
  forReviewer: string[];
  forTechLead: string[];
  metrics: ReturnType<typeof serializeResultSummary>;
  branchComparison?: Awaited<ReturnType<DiffAnalyzer['compare']>>;
}> {
  const resolvedRoot = resolve(projectPath);
  const { result } = await analyzeProjectWithGraph(projectPath, options?.configPath);

  let branchComparison: Awaited<ReturnType<DiffAnalyzer['compare']>> | undefined;
  if (options?.baseBranch) {
    branchComparison = await new DiffAnalyzer().compare(resolvedRoot, options.baseBranch, options.configPath);
  }

  const forAuthor: string[] = [];
  if (result.violations.length === 0) {
    forAuthor.push('No violations — keep boundaries explicit in new code so debt does not accumulate invisibly.');
  } else {
    for (const v of result.topRisks.slice(0, 4)) {
      forAuthor.push(`[${v.severity}] ${v.rule}: ${v.message} — ${v.file}`);
    }
  }

  const critical = result.violations.filter(v => v.severity === 'critical');
  const forReviewer: string[] = [];
  if (critical.length > 0) {
    forReviewer.push(
      `${critical.length} critical issue(s): treat as architectural / layering or feature-boundary problems, not style.`,
    );
  } else {
    forReviewer.push('No critical findings — verify new code does not widen blast radius around shared utilities.');
  }
  if (result.couplingRisk?.hubModules?.length) {
    const top = result.couplingRisk.hubModules[0];
    if (top) {
      forReviewer.push(`Top coupling hub: ${top.modulePath} (riskScore ${top.riskScore}).`);
    }
  }

  const forTechLead: string[] = [
    `Score ${result.score}/100 (${result.status}), confidence ${result.confidenceLevel ?? 'n/a'}.`,
    `Modules ${result.healthyModuleCount}/${result.totalModules} violation-free.`,
  ];
  if (branchComparison) {
    forTechLead.push(branchComparison.summary);
    forTechLead.push(`Branch diff verdict: ${branchComparison.verdict}.`);
  }

  return {
    framing:
      'Role-aware, graph-backed review. Distinct from linters: focuses on **structure, coupling, and drift**, not formatting.',
    forAuthor,
    forReviewer,
    forTechLead,
    metrics: serializeResultSummary(result),
    branchComparison,
  };
}
