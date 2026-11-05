import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const LIMIT_BYTES = 7 * 1024;
const file = new URL('../dist/rum.js', import.meta.url);
const size = gzipSync(readFileSync(file), { level: 9 }).length;

console.log(`dist/rum.js: ${size} B gzipped (limit ${LIMIT_BYTES} B)`);
if (size > LIMIT_BYTES) {
  console.error('Size budget exceeded');
  process.exit(1);
}
