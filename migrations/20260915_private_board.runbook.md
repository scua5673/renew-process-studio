# Private live boards

This additive migration restricts `cs_private_board_v1` and the legacy
`cs_board_live_v1` keys to the current owner of a personal workspace who is still
a member of that workspace. Team-space board rows remain intact, but ordinary
app users cannot read, insert, update or delete them. No data is migrated,
published, renamed, copied, normalized or removed by this SQL.

The application must use the new key and a verified personal workspace. Old
unscoped local live/recovery/snapshot values and old team rows are not evidence
of personal ownership and must not be automatically imported into the new key.
The existing library table and deliberate community publication are separate
contracts; this migration addresses live board documents only.

Before applying, run the read-only preflight and review the actual catalog.
`ps_workspaces.owner_id uuid`, `kind text`, `ps_members.workspace_id/user_id uuid`
and enabled `ps_kv` RLS are required. These columns and RLS were checked in the
read-only production catalog on 2026-09-15 and are reproduced in the local fixture.
Re-run preflight immediately before any authorized installation.
The migration rejects an existing policy or helper with the same name before
any DDL. Reapplication is intentionally refused; do not drop unrelated objects to
make it pass. Existing policies, permission helpers and table grants are left
unchanged. Two catalog-reviewed history reader bodies receive only the board-key
predicate described below; their function OIDs, signatures, owners, security
settings and existing ACLs are preserved.

Both new policies are restrictive. A PUBLIC role gate requires the real database
role to inherit `authenticated` for either board key; a separate authenticated
policy requires personal ownership and membership. This adds conditions to
existing grants/policies instead of granting access. Anonymous JWTs are denied
on both keys without changing unrelated anonymous queries. The read-only helper
is executable only by authenticated users and does not return a board, member
list or workspace data.

The ordinary `ps_kv_history_get` and `ps_kv_history_list` RPCs are security-definer
functions and bypass table RLS. This migration checks the exact source MD5s
`bc15db7508fd9065c0739031bb3a068b` and `0dfcc022d34f4016d9845afc29a5cc03`
before any DDL, then adds a board owner predicate to their existing query.
Team board contents and metadata no longer appear through history, while their
original rows remain. Non-board history and each function's existing access
checks remain unchanged. The administrator-only `ps_admin_kv_history` remains
an administrative recovery path and is not broadened.
The reviewed history table has RLS enabled, no policies, and no direct SELECT
privilege for anonymous or authenticated roles. No public view reads `ps_kv`.
The preflight checks these additional read paths; changed grants, policies or
views require review before installation.

RLS does not constrain a trusted table owner, superuser, BYPASSRLS service role,
or an existing security-definer writer owned by such a role. Do not expose service
credentials to the app. Review the preflight's existing definer-function inventory
for any caller-accessible generic write/read RPC before claiming that every API
path is covered. The reviewed production inventory found no client-callable
generic ps_kv writer; a BEFORE write trigger is therefore not added speculatively.
Administrative backups can still retain legacy originals. Any future generic
definer writer must explicitly enforce the same board owner check.

Test locally with synthetic identities and documents:

```sh
node migrations/20260915_private_board.local-test.cjs
```

The runner uses only in-memory PGlite, the repository's catalog-derived fixture,
and a synthetic service role. It never reads application credentials or contacts
a database server. Run the read-only verify file after any authorized installation.

Rollback is not a routine DROP POLICY: removing this restriction exposes preserved
team boards again through existing permissive policies. An application rollback
to a legacy build may lose access to shared team boards, which is the intended
privacy boundary. Keep the server restriction in place and retain originals until
a separately reviewed recovery is explicitly authorized. No executable rollback
that reopens shared board access is included here.
