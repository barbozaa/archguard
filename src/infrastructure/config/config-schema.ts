import { z } from 'zod';

/**
 * Configuration schema using Zod for validation
 */

const BoundaryRuleSchema = z.object({
  enforce: z.boolean().default(true),
  boundaries: z.array(z.object({
    feature: z.string().describe('Path prefix that identifies this feature (e.g. "features/auth")'),
    allowImportsFrom: z.array(z.string()).describe('Other feature prefixes this feature may import from'),
  })),
});

export const ConfigSchema = z.object({
  entryPoint: z.string().optional(),
  srcDirectory: z.string().default('./src'),
  tsConfigPath: z.string().optional(),
  rules: z.record(z.any()).optional(),
  boundaryRules: BoundaryRuleSchema.optional(),
  ignore: z.array(z.string()).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export const defaultConfig: Config = {
  srcDirectory: './src',
  rules: {},
  ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**'],
};
