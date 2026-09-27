#!/usr/bin/env node
/**
 * Validate a directory laid out like an agent's data branch against the site's zod contracts.
 *
 *   node scripts/validate-data.mjs <agent-id> <dir>
 *   e.g. node scripts/validate-data.mjs repo_maint ../repo-maintain-agent/public-data
 *
 * Prints every failing file with all zod issue paths (not just the first). Exits 1 on failure.
 */
import path from 'node:path';
import { loadSchemas, validateTree } from './lib/contracts.mjs';

const [agentId, dir] = process.argv.slice(2);
if (!agentId || !dir) {
  console.error('usage: node scripts/validate-data.mjs <agent-id> <dir>');
  process.exit(2);
}
const schemas = await loadSchemas();
const results = await validateTree(schemas, agentId, path.resolve(dir));
let bad = 0;
// Group identical issues across files (e.g. the same field failing in all 50 metro files).
const grouped = new Map();
for (const r of results) {
  for (const w of r.warnings ?? []) console.log(`warn  ${w}`);
  if (r.ok) {
    console.log(`ok    ${r.rel}${r.schema ? '' : ' (no schema mapped, not checked)'}`);
    continue;
  }
  bad++;
  for (const i of r.issues) {
    const key = `${i.path || '(root)'}: ${i.message}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(r.rel);
  }
}
for (const [issue, files] of grouped) {
  const shown = files.slice(0, 3).join(', ') + (files.length > 3 ? `, … (${files.length} files)` : '');
  console.log(`FAIL  ${shown}\n      at ${issue}`);
}
console.log(`${results.length - bad}/${results.length} files valid for ${agentId}`);
process.exit(bad ? 1 : 0);
