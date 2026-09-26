#!/usr/bin/env node
// Make `npm run build` / `npm run dev` work offline: if public/data hasn't been assembled
// yet (CI runs `npm run fetch-data` explicitly first), assemble it from fixtures.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

if (!existsSync('public/data/manifest.json')) {
  console.log(
    '[ensure-data] public/data missing; assembling from fixtures (run `npm run fetch-data` for live data)',
  );
  const r = spawnSync(process.execPath, ['scripts/fetch-data.mjs', '--offline'], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
