#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { resolve } from 'path';
import { analyzeProject, analyzeProjectWithGraph } from '@application/analyze-project.js';
import { DiffAnalyzer } from '@application/diff-analyzer.js';
import {
  analyzeChangeImpact,
  buildArchitectureReviewSummary,
  buildDependencyLayerMermaid,
  compareToBaselineReport,
  explainViolationWithRepoContext,
  validateArchguardConfigJson,
} from '@application/mcp-insights.js';
import { RULE_EXPLANATIONS, type RuleExplanationSlug } from '@application/rule-explanations.js';
import { serializeViolation, serializeResultSummary } from '@presentation/utils/violation-utils.js';

const server = new McpServer({
  name: 'archguard',
  version: '1.5.0',
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

// ---------------------------------------------------------------------------
// Tool: analyze_architecture
// ---------------------------------------------------------------------------

server.tool(
  'analyze_architecture',
  'Run a full architecture analysis on a TypeScript project. Returns health score, violations, coupling metrics, and blast radius.',
  {
    projectPath: z.string().describe('Absolute or relative path to the project root'),
    configPath: z.string().optional().describe('Path to archguard.config.json (optional)'),
  },
  async ({ projectPath, configPath }) => {
    try {
      const result = await analyzeProject(projectPath, configPath);

      const output = {
        ...serializeResultSummary(result),
        topRisks: result.topRisks.map(serializeViolation),
        violationCount: result.violations.length,
      };

      return textResult(output);
    } catch (error) {
      return textResult({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: get_violations
// ---------------------------------------------------------------------------

server.tool(
  'get_violations',
  'Get architecture violations, optionally filtered by rule name, severity, or file path.',
  {
    projectPath: z.string().describe('Absolute or relative path to the project root'),
    rule: z.string().optional().describe('Filter by rule name — accepts slug (e.g. "layer-violation") or display name (e.g. "Layer Violation")'),
    severity: z.enum(['info', 'warning', 'critical']).optional().describe('Filter by severity level'),
    filePath: z.string().optional().describe('Filter violations that affect this file path (substring match)'),
    limit: z.number().optional().default(50).describe('Max violations to return (default: 50)'),
    configPath: z.string().optional().describe('Path to archguard.config.json (optional)'),
  },
  async ({ projectPath, rule, severity, filePath, limit, configPath }) => {
    try {
      const result = await analyzeProject(projectPath, configPath);

      let violations = result.violations;

      if (rule) {
        const normalizedInput = rule.toLowerCase().replace(/\s+/g, '-');
        violations = violations.filter(v => {
          const normalizedRule = v.rule.toLowerCase().replace(/\s+/g, '-');
          return normalizedRule === normalizedInput || v.rule === rule;
        });
      }
      if (severity) {
        violations = violations.filter(v => v.severity === severity);
      }
      if (filePath) {
        violations = violations.filter(v => v.file.includes(filePath) || v.relatedFile?.includes(filePath));
      }

      const output = {
        total: violations.length,
        returned: Math.min(violations.length, limit),
        violations: violations.slice(0, limit).map(serializeViolation),
      };

      return textResult(output);
    } catch (error) {
      return textResult({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: get_coupling_risk
// ---------------------------------------------------------------------------

server.tool(
  'get_coupling_risk',
  'Get coupling risk metrics: Ca/Ce/Instability per module, hub detection, blast radius, and overall risk score.',
  {
    projectPath: z.string().describe('Absolute or relative path to the project root'),
    configPath: z.string().optional().describe('Path to archguard.config.json (optional)'),
  },
  async ({ projectPath, configPath }) => {
    try {
      const result = await analyzeProject(projectPath, configPath);

      const output = {
        overallRisk: result.couplingRisk?.overallRisk,
        averages: {
          ca: result.couplingRisk?.projectAverageCa,
          ce: result.couplingRisk?.projectAverageCe,
          instability: result.couplingRisk?.projectAverageInstability,
        },
        totalModules: result.couplingRisk?.totalModules,
        highRiskModules: result.couplingRisk?.highRiskModules,
        hubModules: result.couplingRisk?.hubModules,
        unstableModules: result.couplingRisk?.unstableModules,
        blastRadius: result.blastRadius,
      };

      return textResult(output);
    } catch (error) {
      return textResult({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: explain_violation
// ---------------------------------------------------------------------------

server.tool(
  'explain_violation',
  'Explain an architecture rule (static text). Optionally pass projectPath + filePath to attach live violations and 1-hop import neighbors for that file — graph-backed context, not generic linter docs.',
  {
    rule: z.enum([
      'layer-violation',
      'feature-boundary',
      'too-many-imports',
      'shotgun-surgery',
      'data-clumps',
      'duplicate-code',
    ]).describe('The rule name to explain'),
    projectPath: z.string().optional().describe('Required with filePath: project root'),
    filePath: z
      .string()
      .optional()
      .describe('Repo-relative file (e.g. src/application/analyzer.ts) — adds live matches + import graph'),
    configPath: z.string().optional().describe('Path to archguard.config.json (optional)'),
  },
  async ({ rule, projectPath, filePath, configPath }) => {
    try {
      const explanation = RULE_EXPLANATIONS[rule as RuleExplanationSlug];
      if (!explanation) {
        return textResult({ error: `Unknown rule: ${rule}` });
      }

      if (filePath) {
        if (!projectPath) {
          return textResult({ error: 'projectPath is required when filePath is provided.' });
        }
        const ctx = await explainViolationWithRepoContext(
          projectPath,
          rule as RuleExplanationSlug,
          filePath,
          configPath,
        );
        return textResult({
          rule,
          what: explanation.what,
          why: explanation.why,
          fix: explanation.fix,
          availableSeverities: ['info', 'warning', 'critical'],
          liveContext: {
            matchingViolationsInFile: ctx.matchingViolationsInFile,
            importNeighborsOneHop: ctx.importNeighborsOneHop,
          },
        });
      }

      return textResult({
        rule,
        ...explanation,
        availableSeverities: ['info', 'warning', 'critical'],
      });
    } catch (error) {
      return textResult({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: analyze_change_impact
// ---------------------------------------------------------------------------

server.tool(
  'analyze_change_impact',
  'Change-centric analysis: violations on touched files, violations in the 1-hop dependency neighborhood, local hubs, and a Mermaid subgraph. Answers "what does my edit touch in the graph?" — not a full-repo style scan.',
  {
    projectPath: z.string().describe('Absolute or relative path to the project root'),
    changedFiles: z
      .array(z.string())
      .min(1)
      .describe('Repo-relative paths of files changed in the PR or edit (e.g. ["src/application/foo.ts"])'),
    configPath: z.string().optional().describe('Path to archguard.config.json (optional)'),
  },
  async ({ projectPath, changedFiles, configPath }) => {
    try {
      const out = await analyzeChangeImpact(projectPath, changedFiles, configPath);
      return textResult(out);
    } catch (error) {
      return textResult({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: compare_to_baseline
// ---------------------------------------------------------------------------

server.tool(
  'compare_to_baseline',
  'Compare current analysis to a saved ArchGuard JSON report (e.g. CI artifact from archguard --format json). Surfaces score delta and violations introduced/resolved — architectural drift over time.',
  {
    projectPath: z.string().describe('Absolute or relative path to the project root'),
    baselineReportPath: z
      .string()
      .describe('Path to baseline JSON relative to project root, or absolute path'),
    configPath: z.string().optional().describe('Path to archguard.config.json (optional)'),
  },
  async ({ projectPath, baselineReportPath, configPath }) => {
    try {
      const out = await compareToBaselineReport(projectPath, baselineReportPath, configPath);
      return textResult(out);
    } catch (error) {
      return textResult({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: dependency_graph_mermaid
// ---------------------------------------------------------------------------

server.tool(
  'dependency_graph_mermaid',
  'Mermaid diagram of aggregated internal import flow between top-level buckets (e.g. src/domain → src/application). For architecture maps in PRs or docs — not ESLint output.',
  {
    projectPath: z.string().describe('Absolute or relative path to the project root'),
    configPath: z.string().optional().describe('Path to archguard.config.json (optional)'),
    maxEdges: z.number().optional().default(48).describe('Cap on number of aggregated edges'),
  },
  async ({ projectPath, configPath, maxEdges }) => {
    try {
      const { graph } = await analyzeProjectWithGraph(projectPath, configPath);
      return textResult({
        framing: 'Aggregated cross-bucket internal imports (path-based).',
        mermaid: buildDependencyLayerMermaid(graph, maxEdges),
      });
    } catch (error) {
      return textResult({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: validate_architecture_config
// ---------------------------------------------------------------------------

server.tool(
  'validate_architecture_config',
  'Validate an archguard.config.json body (string) with the same Zod schema as the CLI — gate config edits before commit without running a full analysis.',
  {
    configJson: z.string().describe('Full JSON text of an ArchGuard config file'),
  },
  async ({ configJson }) => {
    try {
      const out = validateArchguardConfigJson(configJson);
      return textResult(out);
    } catch (error) {
      return textResult({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: architecture_review_summary
// ---------------------------------------------------------------------------

server.tool(
  'architecture_review_summary',
  'Role-aware summary bullets for author, reviewer, and tech lead, plus metrics. Optional baseBranch adds git compare. Graph-native PR narrative — distinct from linters.',
  {
    projectPath: z.string().describe('Absolute or relative path to the project root'),
    baseBranch: z
      .string()
      .optional()
      .describe('If set, include compare_branches-style diff vs this branch (e.g. main)'),
    configPath: z.string().optional().describe('Path to archguard.config.json (optional)'),
  },
  async ({ projectPath, baseBranch, configPath }) => {
    try {
      const out = await buildArchitectureReviewSummary(projectPath, {
        baseBranch,
        configPath,
      });
      return textResult(out);
    } catch (error) {
      return textResult({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: compare_branches
// ---------------------------------------------------------------------------

server.tool(
  'compare_branches',
  'Compare architecture health between two git branches. Returns new/resolved violations and score delta. Requires a git repository.',
  {
    projectPath: z.string().describe('Absolute or relative path to the git repository root'),
    baseBranch: z.string().describe('Base branch to compare against (e.g. "main", "develop")'),
    configPath: z.string().optional().describe('Path to archguard.config.json (optional)'),
  },
  async ({ projectPath, baseBranch, configPath }) => {
    try {
      const diff = await new DiffAnalyzer().compare(
        resolve(projectPath),
        baseBranch,
        configPath,
      );

      return textResult(diff);
    } catch (error) {
      return textResult({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ArchGuard MCP server running on stdio');
}

main().catch((error) => {
  console.error('ArchGuard MCP server failed to start:', error);
  process.exit(1);
});
