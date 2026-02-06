#!/usr/bin/env node

import cac from 'cac';
import pc from 'picocolors';
import { ConfigLoader } from '@config/config-loader.js';
import { Analyzer } from '@core/analyzer.js';
import { TerminalReporter } from '@output/terminal-reporter.js';
import { JsonReporter } from '@output/json-reporter.js';
import { ExecutiveReporter } from '@output/executive-reporter.js';
import { Reporter } from '@output/reporter-interface.js';

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
  .action(async (root, options) => {
    try {
      // Change to target directory if provided
      const targetDir = root || process.cwd();
      const originalDir = process.cwd();
      
      if (root) {
        process.chdir(targetDir);
      }

      // Load configuration
      const configLoader = new ConfigLoader();
      const config = await configLoader.load(options.config);

      // Run analysis
      const analyzer = new Analyzer();
      const result = await analyzer.analyze(config);

      // Restore original directory
      if (root) {
        process.chdir(originalDir);
      }

      // Select reporter
      const reporter: Reporter =
        options.format === 'json'
          ? new JsonReporter()
          : options.format === 'executive'
          ? new ExecutiveReporter()
          : new TerminalReporter();

      // Generate report
      reporter.report(result, options.verbose);

      // Show warning if any rules failed
      if (result.ruleErrors && result.ruleErrors.length > 0) {
        console.error(pc.yellow(`\n⚠️  Warning: ${result.ruleErrors.length} rule(s) failed during analysis:`));
        for (const err of result.ruleErrors) {
          console.error(pc.yellow(`   - ${err.ruleName}`));
        }
        console.error(pc.yellow('   Results may be incomplete. Use --verbose for details.\n'));
      }

      // Exit with appropriate code
      if (options.failOnError && result.violations.length > 0) {
        process.exit(1);
      }
    } catch (error) {
      // Restore directory on error
      console.error(pc.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

cli.help();
cli.version('1.0.0');

cli.parse();
