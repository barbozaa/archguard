import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@core': resolve(__dirname, './src/core'),
      '@rules': resolve(__dirname, './src/rules'),
      '@output': resolve(__dirname, './src/output'),
      '@config': resolve(__dirname, './src/config'),
      '@tests': resolve(__dirname, './tests'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/**',
        'bin/**',
        'tests/**',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/types.ts',
        'vitest.config.ts',
        'tsup.config.ts'
      ]
    }
  }
});
