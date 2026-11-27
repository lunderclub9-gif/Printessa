import { describe, expect, it } from 'vitest'
import { parseStoredCart } from './cart-storage'

const validItem = {
  productId: 'product-1',
  variantId: null,
  slug: 'objet-3d',
  name: 'Objet 3D',
  variantLabel: null,
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

  it('returns an empty cart for invalid JSON or a non-array value', () => {
    expect(parseStoredCart('{broken')).toEqual([])
    expect(parseStoredCart(JSON.stringify({ ...validItem }))).toEqual([])
    expect(parseStoredCart(null)).toEqual([])
  })
})
