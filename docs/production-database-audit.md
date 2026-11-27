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

## Source-level change made on this branch

`src/pages/admin/AdminLogin.tsx` now handles unexpected network/runtime failures with a
`try/catch/finally`, always releases the submitting state, verifies the authenticated user ID
before loading the profile, signs out if owner verification fails, and does not block a valid
owner login merely because the optional login-audit RPC is temporarily unavailable.

This source change is committed as `42f40179941939b026935f23485a6e89b13cccdb`. The previous CI
run passed on `d833d1f94dd8330b4464f0ced3bb067206ccb7a2`; the new commit has not yet received a
CI run, so this change is not yet marked verified.

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
