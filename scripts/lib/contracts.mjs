/**
 * Shared by fetch-data.mjs and validate-data.mjs: load the TS zod contracts (via tsx) and map a
 * data-branch path to its schema, so scripts, build and browser use one contract.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tsImport } from 'tsx/esm/api';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function loadSchemas() {
  return tsImport(pathToFileURL(path.join(ROOT, 'src/lib/schemas/index.ts')).href, import.meta.url);
}

/** Zod schema for `rel` (a path inside an agent's data branch), or null when the site doesn't read it. */
export function schemaFor(schemas, agentId, rel) {
  if (rel.startsWith('history/')) rel = 'latest.json'; // history snapshots are latest.json copies
  const common = schemas.COMMON_FILE_SCHEMAS[rel];
  if (common) return common;
  const map = schemas.AGENT_FILE_SCHEMAS[agentId] ?? {};
  if (map[rel]) return map[rel];
  for (const [pattern, s] of Object.entries(map)) {
    if (pattern.includes('*')) {
      const re = new RegExp('^' + pattern.replace('.', '\\.').replace('*', '[^/]+') + '$');
      if (re.test(rel)) return s;
    }
  }
  return null;
}

/**
 * Validate parsed JSON. Returns `[]` when valid, else every issue as `{ path, message }`
 * (`path` is the dotted zod path, e.g. `meta.schema_version`). Also enforces the supported
 * schema_version major on latest.json and history snapshots.
 */
export function validateJson(schemas, agentId, rel, data) {
  const s = schemaFor(schemas, agentId, rel);
  if (!s) return [];
  const res = s.safeParse(data);
  if (!res.success) {
    return res.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  }
  if (rel === 'latest.json' || rel.startsWith('history/')) {
    const major = schemas.SUPPORTED_MAJOR[agentId];
    try {
      if (major != null) schemas.assertMajor(data.meta, major, `${agentId}/${rel}`);
    } catch (e) {
      return [{ path: 'meta.schema_version', message: e.message }];
    }
  }
  return [];
}

async function walk(dir, base = dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p, base)));
    else if (e.name.endsWith('.json')) out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out.sort();
}

/** Validate every JSON file under `dir` (a data-branch checkout or fixture folder). */
export async function validateTree(schemas, agentId, dir) {
  const results = [];
  for (const rel of await walk(dir)) {
    const schema = schemaFor(schemas, agentId, rel);
    let issues;
    try {
      issues = validateJson(schemas, agentId, rel, JSON.parse(await readFile(path.join(dir, rel), 'utf8')));
    } catch (e) {
      issues = [{ path: '', message: `invalid JSON: ${e.message}` }];
    }
    results.push({ rel, schema: !!schema, ok: issues.length === 0, issues });
  }
  return results;
}
