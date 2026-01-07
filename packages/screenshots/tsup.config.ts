import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    minify: false,
    target: 'node18',
    outDir: 'dist',
    shims: true,
  },
  {
    entry: ['src/cli.ts'],
    format: ['cjs'],
    dts: true,
    clean: false,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    minify: false,
    target: 'node18',
    outDir: 'dist',
    shims: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
