# Production database audit — 2026-11-27

This report records read-only checks against the Supabase production database and source review on
`maintenance/consolidated-migrations`. No database schema, migration history, production data,
or production grants were changed during this audit.

## Migration-history mismatch — deployment blocker

The repository currently contains 20 SQL migration files. The production migration-history query
returned only these two versions:

- `20261114233127` — `014_super_admin_owner_management`
- `20261114233352` — `015_harden_super_admin_function_grants`

Neither version is represented by the repository's 20 migration files. The repository README
also says its 20 migrations have not been applied or verified against a live project.

Do not squash, delete, rename, mark-as-applied, or push the 20 files until the two remote migration
records and the actual production schema have been reconciled. A migration-history repair or a
blind `db push` could make the local and remote histories diverge or replay schema changes.
The SQL files must be tested in an isolated database before any production rollout.

## Additional migration-file issue — duplicate version identifier

A source-level check found 20 migration files but only 19 unique 14-digit version identifiers.
These two files share the exact version `20261122120000`:

- `20261122120000_014_product_seo_keywords.sql`
- `20261122120000_016_flexible_custom_requests.sql`

Supabase migration tracking uses the version identifier, so this collision makes CLI ordering and
history reconciliation ambiguous and must be resolved before any migration deployment. The
requested preservation rule is still respected: neither file was renamed, reordered, deleted or
rewritten. CI now emits a non-blocking warning for duplicate migration versions. Obtain explicit
approval for the minimal filename/version correction only after comparing the production schema
and the actual migration contents; do not attempt to push or mark either version as applied now.

## Security advisor findings

Read-only Supabase security advisors returned:

| Finding | Count / level | Assessment |
|---|---:|---|
| `manufacturing_materials_public` is a SECURITY DEFINER view | 1 / ERROR | Review the view's grants and underlying RLS. Prefer `security_invoker = true` if the intended public read still works through the underlying table policies. |
| SECURITY DEFINER functions callable by `anon` | 23 / WARN | Separate public guest endpoints from owner-only and trigger-only functions; revoke anonymous EXECUTE from the latter. |
| SECURITY DEFINER functions callable by `authenticated` | 31 / WARN | Review intended API exposure and least-privilege grants; some authenticated owner RPCs are expected, but trigger helpers are not public APIs. |
| Mutable function `search_path` | 3 / WARN | Pin a safe path and schema-qualify references. |
| RLS enabled without a policy on `tracking_attempts` | 1 / INFO | This may be intentional: the table should be writable only through the tracking RPC. Verify grants and the RPC path rather than adding a public policy. |

The 23 anonymous-executable SECURITY DEFINER functions were:

- Guest-facing candidates that appear to be intentional: `create_custom_request`,
  `create_guest_order`, `decide_custom_quote`, `estimate_manufacturing_dimensions`,
  `estimate_manufacturing_quote`, `get_custom_request_by_token`, `get_order_by_token`,
  `quote_delivery`, and `track_order`.
- Owner-only functions that already check `is_owner()` internally but should not be executable
  by anonymous callers: `create_custom_quote`, `create_custom_quote_from_estimate`,
  `delete_delivered_order`, `delete_order`, `log_owner_event`,
  `owner_reject_custom_request`, `product_cost_estimate`,
  `quote_custom_manufacturing`, `set_custom_request_status`, and `set_order_status`.
- Internal trigger/helper functions that should not be exposed as direct RPC endpoints:
  `audit_row`, `expire_previous_custom_quotes`, `guard_custom_request_status`, and
  `manufacturing_calculate_full`.

The owner-only checks are an important second layer, but they do not replace least-privilege
EXECUTE grants. The trigger helpers should be callable by their triggers, not by API roles.

The three functions without a pinned `search_path` are:

- `public.update_updated_at()`
- `public.next_order_number()`
- `public.customer_quote_breakdown(jsonb)`

The live view definition currently selects only `name`, `colors`, `is_available`, and
`sort_order` from available manufacturing materials. Its `reloptions` are unset, so it is not
configured as a security-invoker view. Confirm the intended public data contract before changing it.

## Performance advisor findings

| Finding | Count | Safe next step |
|---|---:|---|
| Foreign keys without covering indexes | 14 | Add indexes after checking existing indexes, query patterns, and write overhead. |
| RLS policies re-evaluating auth/current-setting functions per row | 13 | Where equivalent, wrap stable calls such as `auth.uid()` in a scalar `(select ...)`. |
| Multiple permissive policies | 22 | Review overlap and combine only when the combined predicate preserves the exact access rules. |
| Unused indexes | 6 | Do not remove based on this snapshot alone; confirm a representative workload and sufficient observation period. |

## Source-level verification on the maintenance branch

The source review has expanded beyond the original owner-login hardening. It now includes the
customer browse/cart/checkout/tracking/custom-request journeys and owner product, order, delivery,
request, notification, material-cost and manufacturing-pricing workflows. The detailed changes
and known limitations are recorded in `docs/maintenance-audit.md`.

The latest fully successful CI run checked commit
`b429c54c08ff7dc1c13b35ebe173d81777d89acd` and passed lint, typecheck, unit tests and production
build. Its `npm ci` step reported zero vulnerabilities; the separate dependency report showed
zero advisories at all severities. Documentation-only follow-up commit
`3614ce493bb336fe5140b0947de74ddaf9117d6e` corrects stale audit wording and is awaiting its own
CI run.

## Additional source migration review finding

Migration `20261127143000_019_order_variant_option_snapshot.sql` creates
`public.set_order_item_variant_label()` as a SECURITY DEFINER trigger function with a pinned
`search_path`, but does not explicitly revoke the default EXECUTE grant from PUBLIC/anon/authenticated.
This function is intended to run only through its trigger, not as a client RPC. Add an explicit
least-privilege revoke in a new forward migration after testing the trigger path on an isolated
database. Do not edit the historical migration file or change production grants during this audit.

The live `manufacturing_materials_public` view remains a separate security-advisor concern: its
underlying table policies and intended public read contract must be tested before converting it to
a security-invoker view. The production advisor counts describe the live database snapshot and
must not be assumed to match the repository migration set while migration history is unresolved.

## Required verification before merge or deployment

1. Reconcile the two remote migration-history versions with the repository and confirm which
   schema changes are already present in production.
2. Create and use an isolated PostgreSQL/Supabase test database; apply the exact timestamp-ordered
   migration set from an empty schema and verify all tables, views, triggers, functions, RLS,
   Storage policies, and seed/reference data.
3. Compare the client and SQL manufacturing-pricing calculations with parity tests.
4. Test guest checkout, stock reservation/cancellation, delivery quoting, request upload and
   tracking, quote acceptance/refusal, owner approval/rejection, archival/deletion, product
   variants/images, and SEO generation end to end.
5. Apply security hardening as a new forward migration only after the affected public RPC flows
   have explicit regression tests.
6. Run lint, typecheck, unit tests, and production build on the final commit.

No production changes should be made until these checks pass.


## Migration handling decision — 2026-11-28

The requested approach is to keep the existing migration files and their execution order.
Do not consolidate them into five files, rename them, or move them out of `supabase/migrations`.

The 20 migration files are retained exactly as they are unless a specific, demonstrated defect
is found. Review them for:
- SQL syntax or dependency-order failures;
- statements that cannot run safely on a clean test database;
- accidental duplicate objects or policies that are not intentional replacements;
- references to missing tables, columns, functions, roles, or extensions;
- insecure grants, RLS gaps, or public exposure;
- data-seed omissions or destructive operations without a safe reason.

Repeated `CREATE OR REPLACE` definitions, explicit `DROP ... IF EXISTS` followed by replacement,
and later hardening migrations are not to be removed merely because they look repetitive.
They may be intentional upgrades. In particular, preserve the Algeria geography dataset and
all security revocations/trigger changes unless a reproducible test proves a defect.

The production migration-history mismatch remains a separate deployment blocker: investigate
and reconcile it without rewriting the repository's historical migration files. No production
migration has been applied as part of this review.
