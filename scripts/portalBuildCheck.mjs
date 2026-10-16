// Checks a portal (CrazyGames) build against the portal's technical requirements.
// Usage: node scripts/portalBuildCheck.mjs [buildDir] (default apps/web/dist-crazygames)
// Needs no dependencies. Limits come from https://docs.crazygames.com/requirements/technical
// (checked 2026-10-16): 250 MB total, 1500 files, initial download <= 50 MB (<= 20 MB for the
// mobile homepage), relative paths only.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LIMITS = {
  totalBytes: 250 * 1024 * 1024,
  files: 1500,
  initialBytes: 20 * 1024 * 1024,
};

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v2.js';
const MB = 1024 * 1024;

/** Problems in the built index.html (an empty list means it is fine). */
export const checkHtml = (html) => {
  const problems = [];
  const sdkTags = html.split(SDK_URL).length - 1;
  if (sdkTags !== 1)
    problems.push(`index.html must load the CrazyGames SDK exactly once (found ${sdkTags})`);
  if (/fonts\.(googleapis|gstatic)\.com/.test(html)) {
    problems.push('index.html still loads Google Fonts (a portal build must be self-contained)');
  }
  const references = [...html.matchAll(/\b(?:src|href)\s*=\s*"([^"]+)"/g)].map((match) => match[1]);
  for (const reference of references) {
    if (reference.startsWith('data:') || reference === SDK_URL) continue;
    if (/^(?:https?:)?\/\//.test(reference)) {
      problems.push(`index.html references an external URL: ${reference}`);
    } else if (reference.startsWith('/')) {
      problems.push(`index.html uses an absolute path (portals need relative paths): ${reference}`);
    }
  }
  return problems;
};

/** The local files index.html pulls in (script and stylesheet references). */
export const referencedFiles = (html) =>
  [...html.matchAll(/\b(?:src|href)\s*=\s*"([^"]+)"/g)]
    .map((match) => match[1])
    .filter((reference) => !/^(?:data:|(?:https?:)?\/\/|\/)/.test(reference))
    .filter((reference) => /\.(?:js|css|mjs)$/.test(reference))
    .map((reference) => reference.replace(/^\.\//, ''));

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );

export const checkBuild = (buildDir, apiBase = process.env.VITE_API_BASE) => {
  const problems = [];
  const indexPath = join(buildDir, 'index.html');
  if (!existsSync(indexPath))
    return { problems: [`${indexPath} does not exist: build first`], stats: null };

  const html = readFileSync(indexPath, 'utf8');
  problems.push(...checkHtml(html));

  const files = walk(buildDir);
  const totalBytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
  const referenced = referencedFiles(html);
  let initialBytes = statSync(indexPath).size;
  for (const reference of referenced) {
    const path = join(buildDir, reference);
    if (existsSync(path)) initialBytes += statSync(path).size;
    else problems.push(`index.html references a missing file: ${reference}`);
  }

  if (files.length > LIMITS.files) problems.push(`${files.length} files (limit ${LIMITS.files})`);
  if (totalBytes > LIMITS.totalBytes)
    problems.push(`${(totalBytes / MB).toFixed(1)} MB total (limit 250 MB)`);
  if (initialBytes > LIMITS.initialBytes) {
    problems.push(
      `${(initialBytes / MB).toFixed(1)} MB initial download (limit 20 MB for the mobile homepage)`,
    );
  }

  if (apiBase) {
    const bundles = referenced.filter((file) => file.endsWith('.js'));
    const baked = bundles.some((file) =>
      readFileSync(join(buildDir, file), 'utf8').includes(apiBase),
    );
    if (!baked) problems.push(`the bundle does not contain the API address ${apiBase}`);
  }

  return { problems, stats: { files: files.length, totalBytes, initialBytes } };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = resolve(process.argv[2] ?? 'apps/web/dist-crazygames');
  const { problems, stats } = checkBuild(dir);
  if (stats) {
    console.log(`Portal build: ${dir}`);
    console.log(`  files:            ${stats.files} (limit ${LIMITS.files})`);
    console.log(`  total size:       ${(stats.totalBytes / MB).toFixed(2)} MB (limit 250 MB)`);
    console.log(
      `  initial download: ${(stats.initialBytes / MB).toFixed(2)} MB (limit 20 MB mobile, 50 MB desktop)`,
    );
  }
  if (problems.length > 0) {
    console.error('Portal build problems:');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log('Portal build OK');
}
