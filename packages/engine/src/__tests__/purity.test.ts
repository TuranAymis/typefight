import { expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const forbidden = [
  'Date',
  'Math.random',
  'performance',
  'window',
  'document',
  'fetch',
  'XMLHttpRequest',
  'setTimeout',
  'setInterval',
  'requestAnimationFrame',
  'localStorage',
  'process.',
  'require(',
];

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith('__') ? [] : sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });

it('keeps every production source file free of ambient APIs', () => {
  for (const path of sourceFiles(sourceRoot)) {
    const source = readFileSync(path, 'utf8');
    for (const token of forbidden) expect(source, `${path} contains ${token}`).not.toContain(token);
  }
});
