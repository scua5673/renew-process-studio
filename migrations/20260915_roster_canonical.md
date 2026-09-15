# Canonical roster contract — prepared, not applied

This is a **local, opt-in server contract draft**. No production migration or
workspace activation was performed for this change. The current application
does not call these RPCs. Installing this draft would not activate any team.
It is not the completed second phase of the roster migration.

## Before an operational proposal

1. Preserve a reviewed catalog snapshot, including every `ps_kv` trigger,
   function owner, membership/permission helper, policy and grant. Installation
   is fresh-only and refuses existing private schema, RPC or trigger names;
   it never silently adopts an unrelated object. This SQL must not be rerun as
   an update migration.
2. Complete and test the client protocol: capability discovery, canonical read,
   exact per-row preimages, metadata/order preimages, durable request IDs,
   acknowledgment of **returned values**, pending-intent recovery, and safe
   handling of older tabs. Existing whole-document and item writers cannot be
   left active on an opted-in team.
3. Review one team's exact raw protected documents and all player IDs. Activation
   requires the complete current key set and byte-identical `v` strings/cupd.
   Within those documents, every `main.players` object must equal its live
   `sq:<id>` object in every JSON field; neither missing rows nor additional live
   rows are accepted. Valid positive deletion timestamps cannot overlap live IDs.
   Malformed JSON, duplicate/invalid IDs and target candidates stop activation.
   No names are used as identity and no union/import/repair is inferred.
4. Independently retain the raw snapshot outside the mutation request. The
   activation transaction also writes and verifies a private database backup
   containing raw main, all SQ rows/tombstones, PD and public mirrors. It never
   replaces the source documents during activation.
5. Define a capacity and retention policy **before enabling a team**. Each
   idempotency receipt currently retains its payload and full returned protected
   snapshot, in addition to the activation backup. This is deliberately durable
   but can grow quickly with frequent saves. Do not delete request receipts while
   any client may still retry their UUID; a compact retained request fingerprint
   and response strategy needs a separate reviewed migration.
6. Test concurrent PostgreSQL sessions and the exact production trigger chain.
   The isolated PGlite suite covers transaction rollback and permissions, but is
   not a multi-session concurrency test. Existing shape guards may reject a large
   roster expansion or removal of every player. This draft detects their OLD/NULL
   substitution and rolls back; it does not disable or bypass those guards.
7. Set and verify the API role/request-level statement timeout. Functions declare
   a 5-second lock timeout and 30-second statement timeout, but PostgreSQL starts
   statement timers at the caller's command boundary ([PostgreSQL documentation](https://www.postgresql.org/docs/16/runtime-config-client.html#GUC-STATEMENT-TIMEOUT)): the API's timeout remains
   necessary for an end-to-end deadline. Activation briefly takes a table-wide
   lock, only after authenticating the team owner and acquiring the team lock.

The read-only production comparison on 2026-09-15 found both matching
and main-only team rosters, plus SQ-only/field-different cases. Consequently a
blanket activation is unsafe. Main-only rows need a separately reviewed,
team-specific migration with originals and exact absence checks. This prepared
file contains no automatic seeding or source-selection operation.

## Protocol 1

All RPCs use `auth.uid()` and an exact member row in a workspace of kind `team`.
The owner alone may activate. Full read/write calls also apply existing roster
permission helpers. Nonowners with missing or malformed permission documents
are denied, rather than inheriting the legacy helper's admin fallback. Membership,
workspace kind and permissions are locked for the transaction.

- `ps_roster_canonical_status(p_wid)` returns `protocol`, `enabled`, `revision`
  without any player data. Membership is required.
- `ps_roster_canonical_read(p_wid)` returns those fields plus explicit `order`
  and protected `rows: [{k,v,cupd}]`. Current full-roster read permission is
  required; a public mirror reader does not automatically receive private rows.
- `ps_roster_canonical_activate(p_wid,p_request_id,p_expected)` takes the exact
  complete array of present protected rows. A missing key in the expectation is
  an assertion of absence. Failure changes neither documents nor mode.
- `ps_roster_canonical_mutate(p_wid,p_request_id,p_changes,p_meta,p_order)` edits
  an enabled team. Each change is `{id,expected_raw,expected_cupd,player}` or
  `{id,expected_raw,expected_cupd,delete:true}`. New IDs require both preimages
  to be null. A full player object is required; current tombstones or PD entries
  cannot be revived by this ordinary save RPC. Repeating a deletion with a new
  request ID is rejected; replaying its original request returns the original ACK.
- Optional `p_meta` is `{expected_raw,expected_cupd,values,removeKeys}` and uses
  the complete prior main raw/cupd as its CAS. It only patches top-level fields;
  `players` and `_items` are reserved. Nested objects in `values` replace those
  specific objects, so callers must retain their unknown nested fields.
- Optional `p_order` is `{expected_cupd,ids}` using the prior main cupd. It must
  contain every live ID exactly once after the row changes. Otherwise existing
  order survives and new IDs append in request order.

The same UUID, actor, operation and complete request payload return the stored
ACK without replaying writes. A reused UUID with different input or another
actor is rejected. Current permissions are rechecked before returning any
stored response. `PT409` means a stale preimage or an incompatible current state;
`22023` means invalid input; `42501` means access denied; direct legacy writes
to active protected keys receive `23514`.

## Preserved originals and atomic projections

`sq:<id>` remains the complete player object; a deletion writes a positive SQ
tombstone and PD marker together. Only explicitly selected SQ rows may change.
All unselected SQ strings and timestamps are compared after projection. Main
non-player fields, including participation, status history, unknown fields and
image references, survive unchanged unless the caller explicitly patches them.
The existing `_items.n` field, when present, follows the new roster count.

Main players, public squad and public attributes are written in the same
transaction. Public player fields are restricted to the existing client mirror
contract. Public attributes use the existing allowlist of criteria, positions,
prompts, example links, categories, group membership, group names and evaluation
mode/set ID. Whole player evaluations, private notes, participation history and
arbitrary main metadata are never copied to the public mirror. Unknown fields
already in those mirror roots remain; the migration does not reinterpret them.

Two new triggers guard active protected keys. The first checks a private permit;
the last consumes it. A permit is bound to the exact transaction/backend, key,
operation, OLD raw/cupd and NEW raw/cupd. No client header, GUC or security-definer
`current_user` value authorizes a write. Clients have no schema, table or helper
access. Actual values are reread after each write and again after projections;
OLD/NULL trigger substitutions and later changes cause a complete rollback.
Existing audit/history, RLS, policy, helper and trigger definitions remain intact.

## Verification and rollback

Run the synthetic test without a production connection:

```sh
node migrations/20260915_roster_canonical.local-test.cjs
```

The runner creates an in-memory PostgreSQL database, uses synthetic JWT actors
with the authenticated role, and checks the real SQL. The separate
`20260915_roster_canonical.verify.sql` performs read-only privilege and trigger
checks and reports the count of explicitly activated workspaces; it reads no
player payloads.

The storage-safety CI workflow runs the same isolated test after the Node
regressions, installing pinned `@electric-sql/pglite@0.5.8` into `RUNNER_TEMP`
with `--ignore-scripts --no-package-lock` and passing its path as `PGLITE_MODULE`.
No database URL, application credentials or production connection are used.

For this prepared, unconnected change, code rollback is a normal revert of the
prepared files; there is no production database state to undo. If the additive
schema is later installed but no team is enabled, legacy clients continue their
existing behavior, so reverting application code does not require deleting the
private backups/schema.

After an actual team activation, reverting to legacy writers is **not** a safe
rollback: the guard deliberately rejects them. A future rollback proposal must
pause canonical writers, back up the latest exact rows and metadata, verify all
projections and pending requests, and provide a reviewed transactional transition.
Do not drop the guards, delete receipts, or toggle `enabled` as an ad-hoc rollback.
No such operational rollback or restoration command is supplied by this draft.
