import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/presentation/cli.ts',
    'src/presentation/mcp-server.ts',
  ],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  dts: false,
  shims: false,
});
