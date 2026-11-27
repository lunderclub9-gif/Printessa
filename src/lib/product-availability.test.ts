import { describe, expect, it } from 'vitest'
import { getProductAvailability } from './product-availability'

describe('getProductAvailability', () => {
  it('uses base product stock when there are no active option values', () => {
    expect(getProductAvailability({
      made_to_order: false,
      stock_quantity: 3,
      product_options: [{ values: [{ is_active: false }] }],
    })).toEqual({ available: true, label: 'En stock' })
  })

  it('does not label a product exhausted when an active variant is in stock', () => {
    expect(getProductAvailability({
      made_to_order: false,
      stock_quantity: 0,
      product_options: [{ values: [{ is_active: true }] }],
      product_variants: [{ stock_quantity: 4, made_to_order: null, is_active: true }],
    })).toEqual({ available: true, label: 'Options disponibles' })
  })

  it('respects variant-level made-to-order settings', () => {
    expect(getProductAvailability({
      made_to_order: false,
      stock_quantity: 0,
      product_options: [{ values: [{ is_active: true }] }],
      product_variants: [{ stock_quantity: 0, made_to_order: true, is_active: true }],
    })).toEqual({ available: true, label: 'Options disponibles' })
  })

  it('ignores inactive variants and reports no availability when all active choices are exhausted', () => {
    expect(getProductAvailability({
      made_to_order: false,
      stock_quantity: 10,
      product_options: [{ values: [{ is_active: true }] }],
      product_variants: [
        { stock_quantity: 10, made_to_order: null, is_active: false },
        { stock_quantity: 0, made_to_order: false, is_active: true },
      ],
    })).toEqual({ available: false, label: 'Épuisé' })
  })
})
