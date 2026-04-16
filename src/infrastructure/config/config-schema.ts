import { z } from 'zod';

/**
 * Configuration schema using Zod for validation
 */

export const ConfigSchema = z.object({
  entryPoint: z.string().optional(),
  srcDirectory: z.string().default('./src'),
  tsConfigPath: z.string().optional(),
  rules: z.record(z.any()).optional(),
  ignore: z.array(z.string()).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export const defaultConfig: Config = {
  srcDirectory: './src',
  rules: {
    maxFileLines: 500,
  },
  ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**'],
};
