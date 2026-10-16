import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkBuild, checkHtml, referencedFiles } from './portalBuildCheck.mjs';

const SDK = '<script src="https://sdk.crazygames.com/crazygames-sdk-v2.js"></script>';
const goodHtml = `<!doctype html><html><head>${SDK}<link rel="icon" href="data:image/svg+xml,x" />
<script type="module" crossorigin src="./assets/index-abc.js"></script>
<link rel="stylesheet" crossorigin href="./assets/index-abc.css" /></head><body></body></html>`;

test('a correct portal page has no problems', () => {
  assert.deepEqual(checkHtml(goodHtml), []);
});

test('the SDK must be present exactly once', () => {
  assert.equal(checkHtml(goodHtml.replace(SDK, '')).length, 1);
  assert.equal(checkHtml(goodHtml.replace(SDK, SDK + SDK)).length, 1);
});

test('Google Fonts, external URLs and absolute paths are rejected', () => {
  const fonts = goodHtml.replace(
    '</head>',
    '<link href="https://fonts.googleapis.com/css2?x" rel="stylesheet"></head>',
  );
  assert.ok(checkHtml(fonts).some((p) => p.includes('Google Fonts')));
  const external = goodHtml.replace(
    '</head>',
    '<script src="https://cdn.example.com/a.js"></script></head>',
  );
  assert.ok(checkHtml(external).some((p) => p.includes('external URL')));
  const absolute = goodHtml.replace('./assets/index-abc.js', '/assets/index-abc.js');
  assert.ok(checkHtml(absolute).some((p) => p.includes('absolute path')));
});

test('lists only local scripts and styles, without the leading ./', () => {
  assert.deepEqual(referencedFiles(goodHtml), ['assets/index-abc.js', 'assets/index-abc.css']);
});

const makeBuild = (html, js = 'const a="https://api.example";') => {
  const dir = mkdtempSync(join(tmpdir(), 'portal-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), html);
  writeFileSync(join(dir, 'assets', 'index-abc.js'), js);
  writeFileSync(join(dir, 'assets', 'index-abc.css'), 'body{}');
  return dir;
};

test('a good build passes and reports its size', () => {
  const dir = makeBuild(goodHtml);
  try {
    const { problems, stats } = checkBuild(dir, 'https://api.example');
    assert.deepEqual(problems, []);
    assert.equal(stats.files, 3);
    assert.ok(stats.initialBytes > 0 && stats.initialBytes <= stats.totalBytes);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a build without the API address baked in is rejected', () => {
  const dir = makeBuild(goodHtml, 'const a="/api";');
  try {
    const { problems } = checkBuild(dir, 'https://api.example');
    assert.ok(problems.some((p) => p.includes('API address')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a missing referenced file and a missing build are reported', () => {
  const dir = makeBuild(goodHtml.replace('index-abc.css', 'gone.css'));
  try {
    assert.ok(checkBuild(dir, undefined).problems.some((p) => p.includes('missing file')));
    assert.ok(checkBuild(join(dir, 'nope'), undefined).problems[0].includes('build first'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
