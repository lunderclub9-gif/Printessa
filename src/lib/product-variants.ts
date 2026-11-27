export type VariantOptionInput = {
  id: string
  values: { id: string; value: string; is_active: boolean }[]
}

export type VariantCombination = {
  valueIds: string[]
  label: string
}

export type VariantCombinationResult =
  | { combinations: VariantCombination[]; reason: null }
  | { combinations: []; reason: 'empty-options' | 'missing-values' | 'limit-exceeded' }

/** Creates a stable key regardless of the order in which option values are supplied. */
export function variantCombinationKey(valueIds: string[]): string {
  return [...valueIds].sort().join(',')
}

/**
 * Builds active option combinations, checking the cartesian-product size before
 * allocating it so a large option matrix cannot freeze the admin page.
 */
export function buildVariantCombinations(
  options: VariantOptionInput[],
  maxCombinations = 100
): VariantCombinationResult {
  if (options.length === 0) return { combinations: [], reason: 'empty-options' }

  const activeOptions = options.map((option) => ({
    ...option,
    values: option.values.filter((value) => value.is_active),
  }))

  if (activeOptions.some((option) => option.values.length === 0)) {
    return { combinations: [], reason: 'missing-values' }
  }

  let total = 1
  for (const option of activeOptions) {
    total *= option.values.length
    if (total > maxCombinations) {
      return { combinations: [], reason: 'limit-exceeded' }
    }
  }

  const combinations: VariantCombination[] = []
  const build = (index: number, selected: { id: string; label: string }[]) => {
    if (index === activeOptions.length) {
      combinations.push({
        valueIds: selected.map((item) => item.id),
        label: selected.map((item) => item.label).join(' / '),
      })
      return
    }

    for (const value of activeOptions[index].values) {
      build(index + 1, [...selected, { id: value.id, label: value.value }])
    }
  }

  build(0, [])
  return { combinations, reason: null }
}
