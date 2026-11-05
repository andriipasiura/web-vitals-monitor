import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: 'esm',
    target: 'es2020',
    platform: 'browser',
    dts: true,
    noExternal: ['@rum/shared'],
  },
  {
    entry: { rum: 'src/script.ts' },
    format: 'iife',
    target: 'es2020',
    platform: 'browser',
    minify: true,
    noExternal: [/.*/],
    outExtension: () => ({ js: '.js' }),
  },
]);
