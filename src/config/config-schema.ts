import { z } from 'zod';

/**
 * Configuration schema using Zod for validation
 */

const LayerRulesSchema = z.record(z.array(z.string())).optional();

const ForbiddenImportSchema = z.object({
  pattern: z.string(),
  from: z.string(),
});

export const ConfigSchema = z.object({
  entryPoint: z.string().optional(),
  srcDirectory: z.string().default('./src'),
  tsConfigPath: z.string().optional(),
  rules: z.object({
    maxFileLines: z.number().default(500),
    layerRules: LayerRulesSchema,
    forbiddenImports: z.array(ForbiddenImportSchema).optional(),
  }).optional(),
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
