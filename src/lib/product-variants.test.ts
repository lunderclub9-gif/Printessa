import { describe, expect, it } from 'vitest'
import { buildVariantCombinations, getVariantIdsUsingOptionValues, variantCombinationKey } from './product-variants'

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


describe('getVariantIdsUsingOptionValues', () => {
  const variants = [
    { id: 'variant-a', values: [{ option_value_id: 'round' }, { option_value_id: 'red' }] },
    { id: 'variant-b', values: [{ option_value_id: 'square' }, { option_value_id: 'blue' }] },
    { id: 'variant-c', values: [{ option_value_id: 'red' }] },
    { id: 'variant-empty', values: [] },
  ]

  it('finds every variant linked to any value being removed', () => {
    expect(getVariantIdsUsingOptionValues(variants, ['round', 'red'])).toEqual([
      'variant-a',
      'variant-c',
    ])
  })

  it('returns no variants for an empty removal set', () => {
    expect(getVariantIdsUsingOptionValues(variants, [])).toEqual([])
  })

  it('does not match variants with no option-value links', () => {
    expect(getVariantIdsUsingOptionValues(variants, ['missing'])).toEqual([])
  })
})
