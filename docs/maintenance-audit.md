# Printessa maintenance audit

This branch is a cleanup pass only. Keep the storefront, checkout, custom-request workflow,
owner administration, delivery, 3D preview, SEO and order history working unless a concrete
dead-code or duplicate-flow finding is proven.

## Confirmed repository findings

- The repository has 20 ordered Supabase migrations. The timestamp order differs from the
  numeric suffix around migrations 015 and 016: timestamp 12:00 contains suffix 016, while
  suffix 015 is timestamp 12:30. Supabase migration history is timestamp-based. Do not rename
  or rewrite applied migration files; use a new forward migration for schema changes.
- The README listed only migrations 001–015 and incorrectly described every migration as safe
  to replay. It now lists all 20 in timestamp order and warns that idempotency is statement-specific.
- The CI workflow did not run on maintenance branches. It now includes `maintenance/**`.
- `ProductEdit.tsx` is approximately 65 KB and combines product loading/saving, media uploads,
  option editing, variant generation and deletion. It is the highest-priority UI decomposition
  candidate, but extraction must preserve its current upload cleanup and variant semantics.
- Manufacturing configuration and product-cost configuration use different database models:
  `manufacturing_materials` (price per gram, density, multiplier and print availability) versus
  `materials` (cost per kilogram for product cost estimates). They look similar in the UI but
  are not proven duplicates. Do not merge or delete either table until every query, RPC and
  stored cost calculation is traced.
- The notification provider and notification center have separate responsibilities (data/state
  versus presentation). Keep that boundary unless a real duplicated subscription or query is found.
- Browser-side manufacturing pricing is explicitly an estimate; PostgreSQL recalculates the
  authoritative quote. Keep both implementations until parity tests cover the shared rules.

## Safe next steps

1. Extract focused modules from the product editor (media, option values, variant operations,
   and persistence) without changing database calls or UI behavior.
2. Add tests around extracted pure functions before moving side effects.
3. Trace all references to both material tables and document their business purpose.
4. Compare client pricing tests with SQL behavior using an isolated PostgreSQL/Supabase database.
5. Validate RLS, RPC grants, storage policies, trigger behavior and migration replay on a disposable
   database. Never experiment on the original LUNDER project or a production database.
6. Run CI (lint, TypeScript, unit tests and production build) after each coherent refactor.

## Guardrails

- No destructive database migration in this cleanup pass without an isolated validation database.
- Do not rename historical migration files or squash applied migrations.
- Do not remove a feature solely because its implementation is large or its UI looks similar.
- Keep this work on `maintenance/cleanup-audit`; do not merge it into `main` until checks and
  review are complete.
