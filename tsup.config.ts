import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/cli.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'bin',
  clean: true,
  dts: false,
  shims: false,
  esbuildOptions(options) {
    options.banner = {
      js: '',
    };
  },
});
