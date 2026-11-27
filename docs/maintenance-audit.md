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
  busy states and tell the owner to verify the result before retrying. The owner order list and
  notification deep links now also handle rejected network requests without leaving the list
  permanently loading.
- Hardened custom-request quote creation, status changes, quote approval/rejection and the
  multi-step request/file deletion workflow so interrupted requests remain recoverable. The
  owner request list and notification deep links now also catch failed network requests and release
  their loading state.
- Added an explicit error and retry state to the owner product list instead of presenting a
  failed product query as an empty catalogue.
- Hardened the delivery administration screen: parallel wilaya data loads are guarded against
  stale responses, query failures are visible, delay ranges are validated, and deleting a pickup
  point now requires confirmation.
- Fixed category management silently discarding save errors. SEO fallback is now used only when
  the SEO columns are genuinely missing; connection/permission failures no longer masquerade as
  an unapplied migration.
- Made public product detail distinguish a network/loading failure from a genuinely missing
  product, added retry, and prevented a slower previous product request from replacing the
  currently selected product.
- Made product editing reject invalid prices, stock, production lead times and weights before
  saving; failed product/media loads are now surfaced instead of silently presenting incomplete
  data.
- Improved gallery safety: if changing the primary image fails, the editor attempts to restore the
  previous primary image and reports when restoration also fails; deleting the current primary
  image now reports if a replacement primary image could not be set.
- Hardened the owner notification center against stale overlapping loads and rejected network
  requests; failed read-state updates now return a recoverable error instead of leaving an
  unhandled promise rejection.
- Added a non-blocking dependency-audit report to CI and an isolated npm 11 update workflow.
  The workflow applied compatible non-breaking updates, ran lint/typecheck/tests/build successfully,
  and committed the validated lockfile. The latest CI `npm audit` now reports 0 vulnerabilities
  (previously 14: 2 low, 11 moderate, 1 high).
- Fixed a customer-facing cart defect for products using the legacy `available_colors` field:
  choosing two different colors for the same base product now creates distinct cart lines instead
  of merging quantities. The selected color survives local-storage reloads and is carried into the
  order note, which is shown on customer confirmation and in the owner order view. Legacy cart
  entries without a color remain compatible.
- Added tests for color-specific cart line identity and legacy cart parsing.
- Aligned the customer cart with the database's 20-line order limit. New distinct cart lines are
  blocked with clear feedback once the limit is reached; existing oversized carts can be reduced
  manually and checkout refuses to submit until they fit. The server-side limit remains unchanged.
- Product cards now calculate availability from active option values and variant-level stock or
  made-to-order flags. Previously a product with zero base stock could be shown as exhausted even
  when one of its selectable variants was available.
- Hardened the catalogue and category pages against stale search responses and rejected network
  requests; category failures now have a retry state rather than appearing as a missing category.
- Hardened the storefront home-page catalogue load and public store-settings load against thrown
  network failures.
- Corrected route-level SEO behavior: the store layout now restores page metadata when navigating
  between routes, while product/category metadata can override the route defaults. Optional
  description, keywords and social-image tags are removed when absent so a previous product's
  metadata does not leak onto the next page.
- Customer-specific cart, checkout, order-confirmation and tracking routes now receive
  `noindex,nofollow` metadata so private customer workflows are not intentionally offered to
  search engines.
- The 3D viewer now resets its loading state when a product model URL changes and exposes a retry
  action after model/import failures, rather than leaving the customer with a permanent dead end.
- Product deletion now traverses nested Storage folders (including option-value images), checks
  whether each public object URL is still referenced before deleting it, and always releases the
  busy state. If the database deletion succeeds but cleanup cannot be confirmed, files are kept
  and the owner is told that manual cleanup may be needed.
- Product option and variant management now catches interrupted create/update/delete operations,
  validates integer stock and price inputs, confirms destructive variant/value removal, and disables
  repeated variant-creation actions while a batch is running.
- Deleting an option, option value or variant checks for other references before removing its
  uploaded image; replacing an option/variant image also attempts to remove the previous unshared
  file. Failed reference checks preserve the old file and surface a warning rather than risking
  deletion of shared media.

## Migration deployment blockers

- In addition to the production migration-history mismatch, the repository has 20 migration files
  but only 19 unique version identifiers: migrations 014 and 016 both start with
  `20261122120000`. This was documented and CI now warns about duplicate identifiers. Per the
  preservation decision, the files were not renamed or rewritten; no migration deployment is safe
  until the conflict and remote history are reconciled.

## Confirmed product behavior gap

- Product detail currently lets customers choose a value from `available_colors` when the product
  has no structured option variants, but that selection is not included in the cart line or
  `create_guest_order` payload. The SQL order-creation function snapshots only the database
  variant label, so this color choice is lost from the actual order. This is a real end-to-end
  defect, not a visual issue. Fixing it safely requires validating the selected color against the
  product's allowed colors and storing it in the order-item snapshot through a new forward
  migration. Do not change the historical 20 migrations or deploy this schema change until the
  production migration-history mismatch is reconciled and an isolated database test is available.

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
