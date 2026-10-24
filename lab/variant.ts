export const BASELINE_VARIANT = 'baseline'
const VARIANT_PARAM = 'variant'

function paramsOf(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
}

export function variantFromSearch(search: string): string {
  const value = paramsOf(search).get(VARIANT_PARAM) ?? ''
  return value === '' || value === BASELINE_VARIANT ? BASELINE_VARIANT : value
}

export function searchWithVariant(search: string, variant: string): string {
  const params = paramsOf(search)
  params.delete(VARIANT_PARAM)
  if (variant !== BASELINE_VARIANT) params.set(VARIANT_PARAM, variant)
  const encoded = params.toString()
  return encoded === '' ? '' : `?${encoded}`
}

export function variantIdsFromFiles(files: string[]): string[] {
  return files
    .filter((f) => f.endsWith('.css'))
    .map((f) => f.slice(f.lastIndexOf('/') + 1, -'.css'.length))
    .filter((id) => id !== BASELINE_VARIANT)
    .sort()
}
