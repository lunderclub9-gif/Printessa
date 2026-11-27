import { describe, expect, it } from 'vitest'
import { canAddCartLine, cartLineKey, MAX_ORDER_LINES, parseStoredCart } from './cart-storage'

const validItem = {
  productId: 'product-1',
  variantId: null,
  slug: 'objet-3d',
  name: 'Objet 3D',
  variantLabel: null,
  selectedColor: null,
  unitPriceDzd: 1200,
  quantity: 2,
  imageUrl: null,
}

describe('parseStoredCart', () => {
  it('rebuilds stable keys and keeps valid legacy cart entries', () => {
    expect(parseStoredCart(JSON.stringify([validItem]))).toEqual([
      { ...validItem, key: 'product-1::base' },
    ])
  })

  it('rejects malformed prices, quantities and required fields', () => {
    const invalid = [
      { ...validItem, unitPriceDzd: Number.NaN },
      { ...validItem, unitPriceDzd: -1 },
      { ...validItem, quantity: 0 },
      { ...validItem, quantity: 1.5 },
      { ...validItem, productId: '' },
      { ...validItem, name: null },
    ]
    expect(parseStoredCart(JSON.stringify(invalid))).toEqual([])
  })

  it('caps quantities and ignores duplicate product variants', () => {
    const result = parseStoredCart(JSON.stringify([
      { ...validItem, quantity: 99 },
      { ...validItem, quantity: 3 },
    ]))
    expect(result).toHaveLength(1)
    expect(result[0].quantity).toBe(10)
  })

  it('keeps the same product in separate lines when colors differ', () => {
    const items = parseStoredCart(JSON.stringify([
      { ...validItem, selectedColor: 'Rouge' },
      { ...validItem, selectedColor: 'Bleu' },
      { ...validItem, selectedColor: 'rouge' },
    ]))
    expect(items).toHaveLength(2)
    expect(items.map((item) => item.selectedColor)).toEqual(['Rouge', 'Bleu'])
    expect(items[0].key).toBe(cartLineKey('product-1', null, 'Rouge'))
    expect(items[1].key).toBe(cartLineKey('product-1', null, 'Bleu'))
  })

  it('accepts legacy cart lines without a selectedColor field', () => {
    const legacyItem = {
      productId: 'product-1',
      variantId: null,
      slug: 'objet-3d',
      name: 'Objet 3D',
      variantLabel: null,
      unitPriceDzd: 1200,
      quantity: 2,
      imageUrl: null,
    }
    expect(parseStoredCart(JSON.stringify([legacyItem]))[0].selectedColor).toBeNull()
  })

  it('caps new distinct cart lines at the server order limit but allows an existing line', () => {
    const fullCart = Array.from({ length: MAX_ORDER_LINES }, (_, index) => ({ key: `line-${index}` }))
    expect(canAddCartLine(fullCart, 'new-line')).toBe(false)
    expect(canAddCartLine(fullCart, 'line-0')).toBe(true)
    expect(canAddCartLine(fullCart.slice(0, MAX_ORDER_LINES - 1), 'new-line')).toBe(true)
  })

  it('returns an empty cart for invalid JSON or a non-array value', () => {
    expect(parseStoredCart('{broken')).toEqual([])
    expect(parseStoredCart(JSON.stringify({ ...validItem }))).toEqual([])
    expect(parseStoredCart(null)).toEqual([])
  })
})
