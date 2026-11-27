type AvailabilityProduct = {
  made_to_order: boolean
  stock_quantity: number
  product_options?: { values?: { is_active: boolean }[] }[]
  product_variants?: { stock_quantity: number; made_to_order: boolean | null; is_active: boolean }[]
}

export function getProductAvailability(product: AvailabilityProduct): {
  available: boolean
  label: string
} {
  const hasSelectableOptions = product.product_options?.some((option) =>
    option.values?.some((value) => value.is_active)
  ) ?? false
  if (!hasSelectableOptions) {
    if (product.made_to_order) return { available: true, label: 'Sur commande' }
    return product.stock_quantity > 0
      ? { available: true, label: 'En stock' }
      : { available: false, label: 'Épuisé' }
  }

  const activeVariants = product.product_variants?.filter((variant) => variant.is_active) ?? []
  const available = activeVariants.some(
    (variant) => (variant.made_to_order ?? product.made_to_order) || variant.stock_quantity > 0
  )
  return {
    available,
    label: available ? 'Options disponibles' : 'Épuisé',
  }
}
