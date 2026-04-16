#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { resolve } from 'path';
import { analyzeProject } from '@application/analyze-project.js';
import { DiffAnalyzer } from '@application/diff-analyzer.js';
import { serializeViolation, serializeResultSummary } from '@presentation/utils/violation-utils.js';

const server = new McpServer({
  name: 'archguard',
  version: '1.3.1',
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

const RULE_EXPLANATIONS: Record<string, { what: string; why: string; fix: string }> = {
  'layer-violation': {
    what: 'A file imports from a layer it should not depend on, violating the configured architectural boundaries.',
    why: 'Layer violations break separation of concerns. They create tight coupling between layers, making it impossible to swap implementations (e.g. change database) without touching higher layers. They also prevent proper unit testing since you can\'t mock a layer that\'s bypassed.',
    fix: 'Route the dependency through the proper layer. If Presentation needs data, go through Application, not directly to Infrastructure. Use dependency inversion: depend on interfaces defined in inner layers, implemented in outer layers.',
  },
  'too-many-imports': {
    what: 'A file has more import statements than the configured threshold (default: 15).',
    why: 'High import count signals a file with too many responsibilities (SRP violation). It\'s tightly coupled to the rest of the codebase, fragile to changes, hard to test, and creates cognitive overload for developers reading it.',
    fix: 'Split the file into focused modules, each with a single responsibility. Extract cohesive groups of functionality into their own files. Use facade patterns to reduce the number of direct dependencies.',
  },
  'shotgun-surgery': {
    what: 'An exported symbol (function, class) is imported in many files (default: 5+), meaning any change to it forces updates across the codebase.',
    why: 'High fan-out creates change amplification: one modification requires touching many files, increasing regression risk and coordination overhead. It often indicates poor encapsulation — internals are leaking across module boundaries.',
    fix: 'Introduce a facade or service that centralizes access to the symbol. Downstream consumers depend on the facade instead, insulating them from changes to the underlying implementation.',
  },
  'data-clumps': {
    what: 'The same group of 3+ parameters appears together in multiple function signatures (default: 3+ occurrences).',
    why: 'Repeating parameter groups signal a missing abstraction. Those parameters form a cohesive concept that should be a type. Without it, parameters can be passed in wrong order, adding fields requires updating every signature, and the relationship between params is implicit.',
    fix: 'Extract the parameter group into an interface or class (Value Object pattern). Replace the individual parameters with a single typed object. This makes function signatures cleaner, self-documenting, and easier to extend.',
  },
  'duplicate-code': {
    what: 'Identical normalized code blocks (5+ lines) appear in multiple files.',
    why: 'Duplicated logic means bugs must be fixed in multiple places. Over time, copies drift apart, leading to inconsistent behavior. It increases maintenance cost and testing burden.',
    fix: 'Extract the duplicated logic into a shared function or utility module. Import it from all call sites. This creates a single source of truth that can be tested once and improved globally.',
  },
  'feature-boundary': {
    what: 'A file inside one feature boundary imports from another feature that is not listed in its allowImportsFrom configuration.',
    why: 'Feature isolation is critical for team autonomy and independent deployability. When feature/auth imports directly from feature/payments, changes to payments can break auth — forcing cross-team coordination, increasing regression risk, and making it impossible to extract features into separate packages or services later.',
    fix: 'Move shared logic to a common module (e.g. "features/shared") and add it to allowImportsFrom. If the dependency is intentional, explicitly allow it in archguard.config.json. For loose coupling, consider event-driven communication between features.',
  },
};

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
  'Get a detailed explanation of a specific architecture rule: what it detects, why it matters, and how to fix it.',
  {
    rule: z.enum([
      'layer-violation',
      'feature-boundary',
      'too-many-imports',
      'shotgun-surgery',
      'data-clumps',
      'duplicate-code',
    ]).describe('The rule name to explain'),
  },
  async ({ rule }) => {
    const explanation = RULE_EXPLANATIONS[rule];
    if (!explanation) {
      return textResult({ error: `Unknown rule: ${rule}` });
    }

    return textResult({
      rule,
      ...explanation,
      availableSeverities: ['info', 'warning', 'critical'],
    });
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
