# Printessa — technical and product audit

This branch now covers a broader reliability and product-quality review, not only cleanup.
The goal is to improve the existing 3D-printing storefront without removing working features
or changing production data.

## Confirmed repository findings

- The repository contains 20 Supabase migration files. Their timestamp order differs from
  numeric suffix order around migrations 015 and 016: suffix 016 has timestamp 12:00 while
  suffix 015 has timestamp 12:30. Supabase orders migrations by timestamp. Preserve the files
  and their historical order; do not rename, squash, delete, or replay them blindly.
- The production project records two migration versions that are absent from this repository.
  This is a deployment blocker until the history and live schema are reconciled read-only.
- CI now runs on `maintenance/**`. The last fully completed baseline run before the current
  reliability changes passed lint, typecheck, unit tests and production build.
- `ProductEdit.tsx` is approximately 65 KB and still combines product loading/saving, media,
  options, variants and deletion. Pure helpers for variant combinations and media storage paths
  have already been extracted and tested. Further extraction should be incremental.
- `manufacturing_materials` and `materials` represent different business concepts and must
  not be merged: manufacturing pricing uses gram-level material data; product costing uses
  kilogram-level material costs.
- Manufacturing price calculations in the browser are estimates. PostgreSQL remains the
  authoritative source for quotes and order totals.
- Notification state/subscriptions and notification presentation have separate responsibilities;
  do not merge them without evidence of duplicated subscriptions or queries.

## Reliability fixes added on this branch

- Added `src/lib/cart-storage.ts` to treat browser local-storage content as untrusted input.
  It validates required fields, rejects invalid prices and quantities, reconstructs stable line
  keys, limits quantities and ignores duplicate product/variant lines.
- Added unit tests for valid legacy cart data, malformed values, quantity limits, duplicates,
  invalid JSON and non-array storage.
- Hardened checkout submission so thrown network failures and incomplete RPC responses show a
  recoverable message, preserve the cart and always release the submitting state.
- Added cancellation guards to delivery lookups so a slower response for a previous wilaya cannot
  overwrite the current commune or pickup-point lists.
- Added explicit handling for failed delivery quote and location lookups.
- Hardened custom-request estimation against slow/stale responses, invalidated old calculations
  when inputs change, and ensured network failures release the loading state.
- Hardened custom-request submission, order tracking, quote decisions and order confirmation
  against thrown network failures while keeping customer-submitted files/cart data available.
- Hardened the owner dashboard retry flow and settings load/save flow so network failures do not
  leave permanent loading states or silently replace existing settings with blank values.
- Made owner sign-out continue even if the audit-event RPC is unavailable.
- Hardened order status changes, archiving and permanent deletion so network failures release
  busy states and tell the owner to verify the result before retrying.
- Hardened custom-request quote creation, status changes, quote approval/rejection and the
  multi-step request/file deletion workflow so interrupted requests remain recoverable.
- Added an explicit error and retry state to the owner product list instead of presenting a
  failed product query as an empty catalogue.

## Dependency review — outstanding

- GitHub Actions `npm ci` reports 14 dependency vulnerabilities (2 low, 11 moderate, 1 high).
  Identify the exact affected direct/transitive packages and compatible patched versions before
  changing the lockfile. Do not run `npm audit fix` blindly because it may introduce breaking
  dependency upgrades.

## Database and security review — outstanding

- Keep all 20 migration files unchanged unless a concrete defect is proven. Intentional
  `CREATE OR REPLACE` revisions and later security hardening are part of the historical sequence.
- Production migration-history mismatch remains unresolved. No production schema, grants,
  migration history or data have been changed.
- Review SECURITY DEFINER functions and EXECUTE grants by call path. Public guest RPCs must remain
  callable where the storefront requires them; owner-only RPCs and internal trigger helpers
  should not be exposed unnecessarily. Do not revoke grants until client and trigger paths are
  confirmed.
- Review the `manufacturing_materials_public` view and its security-invoker behavior against the
  intended public material catalogue before changing it.
- Review missing FK indexes, RLS policy performance advisories and unused indexes against actual
  query patterns. Do not make blanket index or policy changes.
- Test SQL behavior, RLS, grants, storage policies and trigger behavior on a disposable database
  before proposing any forward migration.

## Remaining product and source audit

1. Trace every customer journey: browse, product options, cart, checkout, confirmation, tracking,
   custom request, quote approval and request status.
2. Trace every owner journey: product/category management, images and 3D models, orders, delivery,
   custom requests, manufacturing pricing, cost configuration, settings and audit history.
3. Check every asynchronous screen for loading, empty, error, retry and stale-response states.
4. Verify all destructive actions have confirmation, server-side authorization and clear results.
5. Check accessibility, mobile layout, image/3D performance, SEO metadata and route fallbacks.
6. Add focused tests for each confirmed bug before or with its fix.
7. Keep changes in this maintenance branch and require passing CI before considering the PR ready.

## Guardrails

- Do not modify the original LUNDER repository.
- Do not modify `main` directly or merge this draft PR during the audit.
- Do not change production Supabase data, schema, grants or migration history.
- Do not rename, squash, reorder or delete the existing 20 migration files.
- Do not remove a feature merely because its implementation is large or visually similar to
  another feature.
- Keep existing business rules, DZD pricing, COD checkout, Algerian wilaya/commune data,
  owner-only administration, custom manufacturing and 3D product viewing intact.
