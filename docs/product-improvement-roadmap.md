# Printessa — product improvement roadmap

This roadmap improves the existing Algeria-focused 3D-printing store in small, testable releases.
It is a proposal based on the current repository structure, not a claim that every item is already
implemented. Existing behavior and production data take priority over novelty.

## Product direction

Printessa should make three journeys feel effortless:

1. A customer discovers a ready-made 3D-printed product, understands its options and delivery cost,
   and places a COD order with confidence.
2. A customer submits a custom-print request, follows its progress, reviews a clear quote and
   approves it without needing an account.
3. The owner can run the shop from one reliable workspace: products, production quotes, orders,
   delivery, customer requests, costs and store settings.

## Priority 0 — reliability before new features

- Give every data-driven page consistent loading, empty, error and retry states.
- Prevent duplicate submissions and stale asynchronous responses across checkout, custom requests,
  admin forms and status changes.
- Ensure destructive actions always show what will be deleted and require confirmation.
- Keep server-side prices, stock checks, permissions and state transitions authoritative.
- Add tests for order idempotency, variant selection, quote expiry, request deletion safeguards,
  upload cleanup and status transitions.
- Make error messages actionable without exposing database internals or customer secrets.

## Priority 1 — improve the customer buying experience

- Make product options and variants unmistakable: selected values, unavailable combinations,
  price changes, stock and made-to-order status should be visible before adding to cart. Product
  cards now reflect availability from active variants instead of relying only on base-product stock.
- Legacy color choices now stay distinct in the cart and are carried into the order note so the
  customer and owner can see them. The durable target is a dedicated validated order-item option
  snapshot through a forward migration after production migration history is reconciled.
- Keep the cart understandable on mobile, preserve it across refreshes and clearly explain that
  final prices and delivery are verified server-side.
- Improve checkout feedback: show when wilaya/commune data is loading, when a destination has no
  active delivery rate, and when the customer can safely retry.
- Make order confirmation and tracking consistent, with a readable timeline and clear next step.
- Improve custom-request submission with a clear file checklist, upload progress, accepted formats,
  size limits and a summary before sending.
- Present custom quotes in a customer-friendly breakdown: production, material, finishing, delivery,
  total, validity and explicit approve/reject actions.

## Priority 2 — make owner operations faster

- Turn the dashboard into an operational overview: orders needing action, new custom requests,
  delayed production, delivery exceptions and recent activity.
- Add practical filters and saved views for orders and requests (status, date, wilaya, delivery
  method and search), without introducing unnecessary bulk actions.
- Make status changes show the allowed next states and record a clear history entry.
- Improve product editing with a guided sequence: product details, media/3D model, options and
  variants, pricing/stock, SEO, preview and publish.
- Extract the large product editor into focused modules while preserving its current database
  behavior and screen layout.
- Add clear cost-versus-price visibility where the existing cost data supports it; never mix the
  manufacturing material model with product cost materials.

## Priority 3 — 3D-print production workflow

- Add an owner-side production board for custom requests and orders: awaiting review, quote needed,
  quote sent, approved, queued, printing, finishing, ready, shipped and delivered. Map only to
  states the database can safely represent.
- Provide a production worksheet for each approved job with material, color, quantity, estimated
  print time, finishing, notes and due date.
- Add low-stock warnings only when inventory quantities are actually tracked and reliable.
- Record actual material/time usage as a separate operational measurement before using it for
  profitability analytics.
- Keep customer-uploaded 3D files as references unless the owner explicitly chooses to inspect
  them; never imply automatic geometry validation when none exists.

## Priority 4 — trust, discovery and performance

- Validate SEO title, description, canonical URL, sitemap and structured product data for published
  products and categories. Route changes now reset stale dynamic metadata; continue validating
  generated HTML and social previews against a live staging build.
- Improve image alt text, responsive image sizes, lazy loading and 3D viewer loading behavior.
- Check keyboard navigation, focus states, form labels, contrast and reduced-motion preferences.
- Add clear store policies: production lead times, delivery methods, returns/cancellations and COD.
- Add customer reviews or favorites only after moderation, abuse prevention and data ownership are
  designed; they are not prerequisites for a reliable first release.

## Decisions that require evidence first

- Do not add payment gateways while COD is the chosen business model.
- Do not add customer accounts unless they materially improve repeat orders and support.
- Do not add AI or automatic 3D-file analysis.
- Do not create a separate inventory subsystem until material and finished-product stock rules are
  agreed.
- Do not change database schema, RLS, RPC grants or migration history based on advisor warnings
  alone. Verify each call path and test on an isolated database first.

## Release gates

A feature is ready only when:
- its happy path and failure paths are tested;
- loading, empty and retry states are present;
- mobile use is checked;
- owner permissions and guest access are verified;
- no existing customer or owner workflow regresses;
- CI passes on the maintenance branch;
- any database change has a reviewed forward migration and isolated test evidence.

