#!/usr/bin/env node

import cac from 'cac';
import pc from 'picocolors';
import { ConfigLoader } from '@infrastructure/config/config-loader.js';
import { Analyzer } from '@application/analyzer.js';
import { DiffAnalyzer } from '@application/diff-analyzer.js';
import { TerminalReporter } from '@presentation/reporters/terminal-reporter.js';
import { JsonReporter } from '@presentation/reporters/json-reporter.js';
import { ExecutiveReporter } from '@presentation/reporters/executive-reporter.js';
import { Reporter } from '@domain/reporter.js';
import { DiffResult } from '@domain/types.js';

const cli = cac('archguard');

cli
  .command('[root]', 'Analyze TypeScript project architecture')
  .option('--config <path>', 'Path to config file')
  .option('--format <format>', 'Output format (terminal | json | executive)', {
    default: 'terminal',
  })
  .option('--fail-on-error', 'Exit with code 1 if violations exist', {
    default: false,
  })
  .option('--verbose', 'Show detailed diagnostics', {
    default: false,
  })
  .option('--diff <base>', 'Compare architecture against a base branch (e.g. main)')
  .action(async (root, options) => {
    try {
      const targetDir = root || process.cwd();

      // Branch diff mode
      if (options.diff) {
        const diff = await new DiffAnalyzer().compare(targetDir, options.diff, options.config);

        if (options.format === 'json') {
          console.log(JSON.stringify(diff, null, 2));
        } else {
          printDiffReport(diff);
        }

        if (options.failOnError && diff.introduced.length > 0) {
          process.exit(1);
        }
        return;
      }

      // Standard analysis mode
      const originalDir = process.cwd();
      try {
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

        const reporter: Reporter =
          options.format === 'json'
            ? new JsonReporter()
            : options.format === 'executive'
            ? new ExecutiveReporter()
            : new TerminalReporter();

        reporter.report(result, options.verbose);

        if (result.ruleErrors && result.ruleErrors.length > 0) {
          console.error(pc.yellow(`\n⚠️  Warning: ${result.ruleErrors.length} rule(s) failed during analysis:`));
          for (const err of result.ruleErrors) {
            console.error(pc.yellow(`   - ${err.ruleName}`));
          }
          console.error(pc.yellow('   Results may be incomplete. Use --verbose for details.\n'));
        }

        if (options.failOnError && result.violations.length > 0) {
          process.exit(1);
        }
      } finally {
        if (root && process.cwd() !== originalDir) {
          process.chdir(originalDir);
        }
      }
    } catch (error) {
      console.error(pc.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// Diff report (terminal)
// ---------------------------------------------------------------------------

function printDiffReport(diff: DiffResult): void {
  const line = '─'.repeat(60);
  console.log();
  console.log(pc.bold('  Architecture Diff Report'));
  console.log(`  ${line}`);
  console.log(`  Base branch:  ${pc.cyan(diff.baseBranch)}`);
  console.log(`  Head branch:  ${pc.cyan(diff.headBranch)}`);
  console.log(`  ${line}`);

  const deltaColor = diff.scoreDelta > 0 ? pc.green : diff.scoreDelta < 0 ? pc.red : pc.gray;
  const deltaStr = diff.scoreDelta >= 0 ? `+${diff.scoreDelta}` : `${diff.scoreDelta}`;

  console.log(`  Score:  ${diff.baseScore} → ${diff.headScore}  (${deltaColor(deltaStr)})`);
  console.log(`  Violations:  ${diff.baseViolationCount} → ${diff.headViolationCount}`);
  console.log();

  if (diff.introduced.length > 0) {
    console.log(pc.red(pc.bold(`  ✗ ${diff.introduced.length} New Violation${diff.introduced.length > 1 ? 's' : ''}`)));
    for (const v of diff.introduced) {
      console.log(pc.red(`    • [${v.severity}] ${v.rule}: ${v.message}`));
      console.log(pc.gray(`      ${v.file}${v.line ? `:${v.line}` : ''}`));
    }
    console.log();
  }

  if (diff.resolved.length > 0) {
    console.log(pc.green(pc.bold(`  ✓ ${diff.resolved.length} Resolved Violation${diff.resolved.length > 1 ? 's' : ''}`)));
    for (const v of diff.resolved) {
      console.log(pc.green(`    • [${v.severity}] ${v.rule}: ${v.message}`));
      console.log(pc.gray(`      ${v.file}${v.line ? `:${v.line}` : ''}`));
    }
    console.log();
  }

  if (diff.introduced.length === 0 && diff.resolved.length === 0) {
    console.log(pc.gray('  No violation changes between branches.'));
    console.log();
  }

  const verdictColor =
    diff.verdict === 'improved' ? pc.green :
    diff.verdict === 'degraded' ? pc.red : pc.gray;
  const verdictIcon =
    diff.verdict === 'improved' ? '↑' :
    diff.verdict === 'degraded' ? '↓' : '=';

  console.log(`  ${verdictColor(pc.bold(`${verdictIcon} Verdict: Architecture ${diff.verdict.toUpperCase()}`))}`);
  console.log(`  ${line}`);
  console.log();
}

cli.help();
cli.version('1.3.1');

cli.parse();
