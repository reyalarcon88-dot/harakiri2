function normalizeColor(value: unknown) {
  const normalized = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

  if (!normalized) return ''
  if (normalized === 'white' || normalized === 'blanco') return 'white'
  if (normalized === 'bronze' || normalized === 'bronce') return 'bronze'

  return normalized
}

export function isProductCompatibleWithProjectColor(projectColor?: string, productColor?: string) {
  const normalizedProjectColor = normalizeColor(projectColor)
  const normalizedProductColor = normalizeColor(productColor)

  if (!normalizedProjectColor || !normalizedProductColor) return true

  const knownProjectColor =
    normalizedProjectColor === 'white' || normalizedProjectColor === 'bronze'
  const knownProductColor =
    normalizedProductColor === 'white' || normalizedProductColor === 'bronze'

  if (!knownProjectColor || !knownProductColor) return true

  return normalizedProjectColor === normalizedProductColor
}
