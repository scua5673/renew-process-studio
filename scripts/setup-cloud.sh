#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
mode="${1:-full}"
if [[ "$mode" != full && "$mode" != dependencies-only ]]; then
  printf '%s\n' 'Usage: bash scripts/setup-cloud.sh [full|dependencies-only]' >&2
  exit 2
fi

node -e 'if (process.versions.node.split(".")[0] !== "22") { console.error("Use Node 22, matching .nvmrc and CI, before running setup."); process.exit(1); }'
npm ci --ignore-scripts --no-audit --no-fund

if [[ "$mode" == full ]]; then
  if [[ "$(uname -s)" == Linux ]]; then
    ./node_modules/.bin/playwright install --with-deps chromium webkit
  else
    ./node_modules/.bin/playwright install chromium webkit
  fi
fi

node --input-type=module <<'JS'
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
for (const name of ['playwright', '@electric-sql/pglite']) {
  const expected = lock.packages['node_modules/' + name].version;
  const actual = JSON.parse(fs.readFileSync('node_modules/' + name + '/package.json', 'utf8')).version;
  if (actual !== expected) throw new Error(`${name}: ${actual} != lockfile ${expected}`);
  console.log(`${name} ${actual}`);
}
const db = new PGlite();
try {
  const result = await db.query('select 1 as ready');
  if (result.rows[0].ready !== 1) throw new Error('Synthetic SQL engine is not ready');
  console.log('In-memory SQL engine ready');
} finally { await db.close(); }
JS

printf '%s\n' "Cloud setup complete ($mode). Run npm test and npm run test:sql to validate the repository."
