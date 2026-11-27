export type CartItem = {
  key: string
  productId: string
  variantId: string | null
  slug: string
  name: string
  variantLabel: string | null
  unitPriceDzd: number
  quantity: number
  imageUrl: string | null
}

const MAX_QUANTITY = 10
const MAX_CART_LINES = 50

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

/** Parse and normalize browser-stored cart data; local storage is untrusted input. */
export function parseStoredCart(raw: string | null): CartItem[] {
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    const items: CartItem[] = []
    const seen = new Set<string>()

    for (const candidate of parsed.slice(0, MAX_CART_LINES)) {
      if (!isRecord(candidate)) continue

      const { productId, variantId, slug, name, variantLabel, unitPriceDzd, quantity, imageUrl } = candidate
      if (
        typeof productId !== 'string' || !productId.trim() ||
        !(variantId === null || typeof variantId === 'string') ||
        typeof slug !== 'string' || !slug.trim() ||
        typeof name !== 'string' || !name.trim() ||
        !optionalString(variantLabel) ||
        !optionalString(imageUrl) ||
        typeof unitPriceDzd !== 'number' || !Number.isFinite(unitPriceDzd) || unitPriceDzd < 0 ||
        typeof quantity !== 'number' || !Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 1
      ) continue

      const key = `${productId}::${variantId ?? 'base'}`
      if (seen.has(key)) continue
      seen.add(key)
      items.push({
        key,
        productId,
        variantId,
        slug,
        name,
        variantLabel,
        unitPriceDzd,
        quantity: Math.min(MAX_QUANTITY, quantity),
        imageUrl,
      })
    }

    return items
  } catch {
    return []
  }
}
