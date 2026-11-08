# PROCESS STUDIO

This repository is `scua5673/renew-process-studio`, a static football coaching PWA.
The shell is `studio/app.html`; most screens run in iframes. Supabase provides synchronization and permissions.
Read `docs/OPERATIONS.md` before release work and `docs/CLOUD_ENVIRONMENT.md` for cloud setup.

## Develop and validate

- Use Node 22 (`.nvmrc`) and the committed `package-lock.json`.
- Install: `bash scripts/setup-cloud.sh`. This installs Chromium, WebKit and the in-memory SQL engine. No production secrets are needed.
- Unit tests: `npm test`.
- SQL tests: `npm run test:sql` (PGlite, synthetic databases).
- Browser tests: `PS_TEST_GROUP=selection PS_BROWSER_ENGINE=chromium,webkit npm run test:browser`. Choose relevant groups from `tests/browser/run-critical.mjs`; avoid running every group serially for a small change.
- Browser tests start their own fixture servers. Their synthetic accounts and request interception are the test boundary; `tests/fixtures/team-app.mjs` alone is not a safe standalone preview server.
- Use browser/computer tools supported by the current environment for interactive UI work. Do not launch an alternate browser to bypass a tool restriction. CI runs the existing automated browser suite.
- Package: `node scripts/package-site.mjs`. Generated output is `dist/`; do not commit it.

## Data and releases

- A plain local static server and testprocess both connect to the production backend. Test changes with synthetic fixtures, not real accounts or team data.
- Do not clear real-account localStorage/IndexedDB or press save/recovery/bulk sync controls to test. Production DB changes are applied by the user from reviewed migrations and a runbook.
- Branch from `staging` and target `staging` in implementation PRs. `main` publishes the live site. Promote only with the user's explicit deployment authorization, after staging validation; record physical-device tests accurately using `docs/device-checklist.md`.
- Use GitHub → Netlify builds. Do not deploy ZIPs or run `netlify deploy` directly.
- Runtime changes require matching PS_BUILD, service-worker CACHE, script versions and appropriate release notes. Check open PRs before choosing a version. Docs/setup-only changes do not require a runtime version bump.
- Never silently merge an unrelated draft PR. Preserve user changes and use an isolated worktree when needed.

## Product decisions

- Daily is the writing surface; weekly/monthly/yearly views show those records. Do not ask for the same fact twice.
- Record facts without inventing counts, completion or success from missing data.
- Avoid hover-only controls. Main target devices include iPad and phones.
- Use 프로세스FC for sample team names. Keep private user data out of fixtures, logs, screenshots and public PR descriptions.
- Prefer small, reversible fixes and existing module patterns over rewriting the app.
