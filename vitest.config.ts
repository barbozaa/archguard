import { defineConfig } from 'vitest/config';

export default defineConfig({
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
