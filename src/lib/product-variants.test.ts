import { describe, expect, it } from 'vitest'
import { buildVariantCombinations, variantCombinationKey } from './product-variants'

describe('variantCombinationKey', () => {
  it('is independent of selected value order', () => {
    expect(variantCombinationKey(['blue', 'large'])).toBe(variantCombinationKey(['large', 'blue']))
  })
})

describe('buildVariantCombinations', () => {
  it('builds the cartesian product with readable labels', () => {
    const result = buildVariantCombinations([
      { id: 'shape', values: [{ id: 'round', value: 'Ronde', is_active: true }, { id: 'square', value: 'Carrée', is_active: true }] },
      { id: 'color', values: [{ id: 'red', value: 'Rouge', is_active: true }, { id: 'blue', value: 'Bleu', is_active: true }] },
    ])

    expect(result.reason).toBeNull()
    if (result.reason) return
    expect(result.combinations).toEqual([
      { valueIds: ['round', 'red'], label: 'Ronde / Rouge' },
      { valueIds: ['round', 'blue'], label: 'Ronde / Bleu' },
      { valueIds: ['square', 'red'], label: 'Carrée / Rouge' },
      { valueIds: ['square', 'blue'], label: 'Carrée / Bleu' },
    ])
  })

  it('ignores inactive values', () => {
    const result = buildVariantCombinations([
      { id: 'color', values: [{ id: 'red', value: 'Rouge', is_active: true }, { id: 'old', value: 'Ancien', is_active: false }] },
    ])
    expect(result.reason).toBeNull()
    if (!result.reason) expect(result.combinations).toEqual([{ valueIds: ['red'], label: 'Rouge' }])
  })

  it('reports empty options and options without active values', () => {
    expect(buildVariantCombinations([]).reason).toBe('empty-options')
    expect(buildVariantCombinations([{ id: 'color', values: [] }]).reason).toBe('missing-values')
  })

  it('checks the combination limit before generating combinations', () => {
    const options = Array.from({ length: 8 }, (_, index) => ({
      id: String(index),
      values: Array.from({ length: 10 }, (_, value) => ({
        id: `${index}-${value}`,
        value: String(value),
        is_active: true,
      })),
    }))
    expect(buildVariantCombinations(options).reason).toBe('limit-exceeded')
  })
})
