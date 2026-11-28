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

## Read-only live-schema spot check — 2026-11-28

A follow-up `information_schema.columns` query confirmed that the live schema is mixed rather
than a clean match for either the 20-file repository history or the two remote migration records:

| Object | Live observation |
|---|---|
| `products` | Has `seo_title` and `seo_description`, but no `seo_keywords` |
| `categories` | Has only core category columns; `seo_title`, `seo_description` and `seo_keywords` are absent |
| `product_variants` | `image_url` is absent |
| `product_option_values` | `image_url` is absent |
| `order_items` | Has `variant_id` and `variant_label` |
| `custom_requests` | Has manufacturing options and deletion-token columns |
| `owner_notifications` | Table and notification columns exist |
| `set_order_item_variant_label()` | Function is absent from the live database |

The live function check also confirmed that `update_updated_at()`, `next_order_number()` and
`customer_quote_breakdown(jsonb)` are not SECURITY DEFINER, but have no pinned function
configuration; both `anon` and `authenticated` currently have EXECUTE on them. Their current
advisor finding is about mutable `search_path`, not proof of a SECURITY DEFINER privilege
escalation.

This mixed state is evidence of schema drift: some later workflow columns/tables exist, while
several later repository additions are absent. It does not identify which SQL statements were
applied manually or from another branch. Do not infer migration application from the presence of
one column/table. Continue with a full object-by-object comparison and keep all deployment
operations blocked.

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

**Confirmed high-priority exposure — `manufacturing_calculate_full(...)`:** a read-only
inspection of the live function ACL returned
`{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`.
The function is SECURITY DEFINER, owned by `postgres`, and callable by both public API roles.
Its return JSON includes internal line items and `unitProductionCostDzd`, exposing material,
printing, labor, complexity and margin calculations that the customer-facing
`customer_quote_breakdown` wrapper is designed to sanitize. This is not merely an advisor warning:
it is an actual direct information-disclosure path.

The live definitions of `estimate_manufacturing_dimensions`, `estimate_manufacturing_quote`,
`create_custom_request` and `quote_custom_manufacturing` are also SECURITY DEFINER and owned by
`postgres`. Their nested calls to `manufacturing_calculate_full` execute as the function owner,
so a forward fix should revoke direct EXECUTE from `PUBLIC`, `anon` and `authenticated` on the
internal helper while retaining the owner privilege needed by those wrappers. Verify all guest
estimate/request and owner quote flows on an isolated database after the revoke. Also harden its
pinned path to `pg_catalog, public`. Do not make this change directly in production during the
audit.

**Second confirmed exposure — `next_order_number()`:** the live ACL includes PUBLIC, anon and
authenticated EXECUTE, and both API roles have USAGE/UPDATE on `public.order_number_seq`. The
function is SECURITY INVOKER (not SECURITY DEFINER), but directly calls `nextval`, so anonymous
callers can consume order-number sequence values without creating an order. This permits sequence
burning and gaps, and is not a customer-facing feature. The source shows that
`create_guest_order()` calls `next_order_number()` internally; `create_guest_order()` is
SECURITY DEFINER and owned by `postgres`, so a forward fix can revoke direct function execution
and direct sequence privileges from API roles while preserving checkout's owner-level call path.
The `custom_request_seq` ACL also grants anon/authenticated sequence privileges even though
`create_custom_request()` owns the sequence call; remove those unnecessary direct privileges in
the same tested forward migration. Keep the sequence objects and existing values intact.

The owner-only checks are an important second layer, but they do not replace least-privilege
EXECUTE grants. Revoke anonymous access from owner-only RPCs, and keep trigger/helper functions
callable only by the database owner and their internal call paths. Trigger functions such as
`audit_row()` and `guard_custom_request_status()` should not be exposed as direct API endpoints.

The three functions without a pinned `search_path` are:

- `public.update_updated_at()`
- `public.next_order_number()`
- `public.customer_quote_breakdown(jsonb)`

The live view definition currently selects only `name`, `colors`, `is_available`, and
`sort_order` from available manufacturing materials. Its `reloptions` are unset, so it is not
configured as a security-invoker view. Confirm the intended public data contract before changing it.

## Guest upload storage-abuse exposure

The live private `custom-requests` bucket is limited to 25 MiB per object and an allowlist of
MIME types, but the `guest_upload_custom_requests` Storage INSERT policy permits `anon` and
`authenticated` to insert any object whose bucket is `custom-requests`. It does not constrain
the path, associate uploads with a server-issued request session, or enforce a per-request/object
count. The UI's 10-file limit and browser-side file validation can be bypassed by calling Storage
directly. An unauthenticated client can therefore create many private orphan objects and consume
the project's storage quota.

A read-only inventory found 10 objects in this bucket (746,550 bytes total), all unreferenced by
`custom_request_files` and all older than seven days; the database has 2 custom requests and 0
registered file rows. These may be abandoned form uploads, but they have not been deleted because
they are production objects and their ownership/purpose has not been confirmed.

A safe redesign needs server-verifiable upload sessions or another enforceable abuse control,
with path binding, expiry, file-count/size checks, content validation, and a cleanup grace period.
The Storage MIME allowlist is not content inspection: MIME headers can be chosen by the uploader,
and `application/octet-stream` is currently allowed. The React magic-byte validator and the
10-file submission check can both be bypassed by direct Storage API calls. Do not rely on either
as the server-side security boundary. Do not delete the existing 10 objects during this audit.

## RLS per-row auth evaluation findings

The 13 live `auth_rls_initplan` findings are concentrated in these policies:

- `categories`: `owner_insert_categories`, `owner_update_categories`, `owner_delete_categories`
- `products`: `owner_insert_products`, `owner_update_products`, `owner_delete_products`
- `product_images`: `owner_insert_product_images`, `owner_update_product_images`,
  `owner_delete_product_images`
- `profiles`: `select_own_or_owner_profile`, `update_own_profile`
- `owner_notifications`: `owner_read_notifications`, `owner_mark_notifications_read`

The policies currently evaluate `auth.uid()` inside row predicates (and the profile/notification
policies also call `is_owner()`). A forward migration can preserve the same authorization
predicates while wrapping stable calls as scalar subqueries, e.g. `(select auth.uid())` and
`(select public.is_owner())`, so PostgreSQL can evaluate them once per statement rather than once
per candidate row. This is a performance-only rewrite; verify owner/customer RLS behavior before
and after on an isolated database. No live policies were modified.

## Confirmed redundant owner SELECT policies

A read-only comparison of `pg_policies` found 11 SELECT-only owner policies whose role set and
`USING (is_owner())` predicate exactly duplicate an existing `FOR ALL` owner policy on the same
table. PostgreSQL's `FOR ALL` policy already applies to SELECT, so these additional SELECT
policies do not add access and contribute to the multiple-permissive-policy warnings:

- `communes.owner_read_communes` (covered by `owner_write_communes`)
- `delivery_rates.owner_read_delivery_rates` (covered by `owner_write_delivery_rates`)
- `manufacturing_materials."Propriétaire lit les matières"` (covered by
  `"Gestion des matières par la propriétaire"`)
- `manufacturing_pricing."Propriétaire lit la tarification"` (covered by
  `"Gestion de la tarification par la propriétaire"`)
- `pickup_points.owner_read_pickup_points` (covered by `owner_write_pickup_points`)
- `product_option_values.owner_read_product_option_values` (covered by
  `owner_write_product_option_values`)
- `product_options.owner_read_product_options` (covered by `owner_write_product_options`)
- `product_variant_values.owner_read_product_variant_values` (covered by
  `owner_write_product_variant_values`)
- `product_variants.owner_read_product_variants` (covered by `owner_write_product_variants`)
- `store_settings.owner_read_store_settings` (covered by `owner_write_store_settings`)
- `wilayas.owner_read_wilayas` (covered by `owner_write_wilayas`)

These are proven redundant for SELECT based on the live role sets and predicates. A forward
migration can drop only these 11 SELECT-only policies while retaining the `FOR ALL` policies and
all public/customer policies. Test owner reads/writes and public reads on an isolated database
first. No policies were dropped in production.

## Performance advisor findings

A live table-count snapshot shows the current production workload is still small: 12 orders,
12 order items, 2 custom requests, 12 owner notifications, 6 quote events, 0 pickup points and
2 product-cost rows. The related tables occupy only tens to low hundreds of KiB. The advisor's
14 missing-FK-index findings are valid schema observations, but adding all indexes immediately is
not an urgent latency fix at this data volume. Prioritize `order_items(product_id, variant_id)`,
`custom_requests(delivery_*)`, and notification/event foreign keys as those tables grow; validate
existing index definitions and query plans before generating indexes. High sequential-scan counts
on `custom_requests` currently concern a two-row table and should not be interpreted as a scale
problem.



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
`ab92c8f1b8fc719de42cb28655c923364d28e158` and passed lint, typecheck, unit tests and production
build. Its `npm ci` step reported zero vulnerabilities; the dependency report confirmed zero
info, low, moderate, high and critical advisories. The current branch head is
`e845a0f1d6edf8cf7b26efcb888822f67c1754da`; it additionally upgrades GitHub Actions to Node.js
24-compatible releases and makes zero npm advisories a blocking CI requirement. Its CI result is
pending and must be checked before treating the latest head as verified.

## Additional source migration review finding

Migration `20261127143000_019_order_variant_option_snapshot.sql` creates
`public.set_order_item_variant_label()` as a SECURITY DEFINER trigger function with a pinned
`search_path`, but does not explicitly revoke the default EXECUTE grant from PUBLIC/anon/authenticated.
This function is intended to run only through its trigger, not as a client RPC. Add an explicit
least-privilege revoke in a new forward migration after testing the trigger path on an isolated
database. Do not edit the historical migration file or change production grants during this audit.

The live `manufacturing_materials_public` view remains a separate security-advisor concern.
A read-only inspection confirmed that it selects only `name`, `colors`, `is_available` and
`sort_order` for available materials, and grants SELECT on the view to `anon` and
`authenticated`. Its `reloptions` are NULL, so it is not security-invoker. The underlying
`manufacturing_materials` table has RLS policies for both roles that call `is_owner()`, and
the two policies currently overlap for SELECT: an ALL policy and a SELECT-only policy use the
same `is_owner()` predicate. The table's direct anon SELECT grant is revoked.

Do not simply flip the view to security-invoker: that would make the public catalogue stop working
unless a deliberate column-level SELECT grant and an anon RLS policy for available materials are
added and tested together. A safe forward design is to expose only the four public columns, allow
anon to read only rows where `is_available = true`, and run the view as security-invoker; the
redundant SELECT-only owner policy can be removed in that same tested forward migration because
the existing ALL policy already provides the identical owner SELECT predicate. Do not apply this
to production during the audit.

The production advisor counts describe the live database snapshot and must not be assumed to match
the repository migration set while migration history is unresolved.

## Draft forward-migration remediation (not executed)

The following statements are a remediation outline only. Generate a proper new migration with the
Supabase CLI, test it on an isolated database, verify all storefront/admin paths, and reconcile
production migration history before applying anything. Do not paste this directly into the
production SQL editor.

```sql
-- Internal price engine: keep postgres-owner execution for SECURITY DEFINER wrappers only.
REVOKE EXECUTE ON FUNCTION public.manufacturing_calculate_full(text, numeric, numeric, integer, jsonb, boolean)
  FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.manufacturing_calculate_full(text, numeric, numeric, integer, jsonb, boolean)
  SET search_path = pg_catalog, public;

-- Sequence helper is called by create_guest_order() under its postgres owner context.
REVOKE EXECUTE ON FUNCTION public.next_order_number()
  FROM PUBLIC, anon, authenticated;
REVOKE USAGE, SELECT, UPDATE ON SEQUENCE public.order_number_seq
  FROM PUBLIC, anon, authenticated;
REVOKE USAGE, SELECT, UPDATE ON SEQUENCE public.custom_request_seq
  FROM PUBLIC, anon, authenticated;

-- Trigger-only functions do not need direct API-role execution grants.
REVOKE EXECUTE ON FUNCTION public.audit_row() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_previous_custom_quotes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_custom_request_status() FROM PUBLIC, anon, authenticated;

-- SELECT is already covered by each same-role FOR ALL owner policy.
DROP POLICY IF EXISTS owner_read_communes ON public.communes;
DROP POLICY IF EXISTS owner_read_delivery_rates ON public.delivery_rates;
DROP POLICY IF EXISTS "Propriétaire lit les matières" ON public.manufacturing_materials;
DROP POLICY IF EXISTS "Propriétaire lit la tarification" ON public.manufacturing_pricing;
DROP POLICY IF EXISTS owner_read_pickup_points ON public.pickup_points;
DROP POLICY IF EXISTS owner_read_product_option_values ON public.product_option_values;
DROP POLICY IF EXISTS owner_read_product_options ON public.product_options;
DROP POLICY IF EXISTS owner_read_product_variant_values ON public.product_variant_values;
DROP POLICY IF EXISTS owner_read_product_variants ON public.product_variants;
DROP POLICY IF EXISTS owner_read_store_settings ON public.store_settings;
DROP POLICY IF EXISTS owner_read_wilayas ON public.wilayas;
```

Migration 019's `set_order_item_variant_label()` is currently absent from the live database.
After the migration-history reconciliation confirms that 019 is applied, add a separate explicit
revoke for that trigger function in the forward chain; do not include it in a migration that may
run before the function exists.

Before accepting this remediation, test that guest dimension estimates, manual custom requests,
guest checkout/order numbering, owner custom quotes, all owner table reads/writes, public material
catalogue reads, and product/variant storefront reads still work. The public materials view needs
its own coordinated column-grant + RLS + `security_invoker` migration, not a one-line view toggle.
Storage upload abuse needs a server-verifiable upload-session/rate-limit design; the SQL above does
not address it.

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
