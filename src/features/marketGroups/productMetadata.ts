export type CryptoGroupPreviewInput = {
  pair: string
  productSeason: string
  horizon: string
}

function slugPart(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'group'
  )
}

export function cryptoProductSlug(
  input: Pick<CryptoGroupPreviewInput, 'pair' | 'productSeason' | 'horizon'>,
): string {
  const [base = '', quote = ''] = input.pair.split('/')
  return [
    slugPart(base),
    slugPart(quote),
    slugPart(input.productSeason),
    slugPart(input.horizon),
    'season',
  ].join('-')
}

export function cryptoSeasonKey(
  input: Pick<CryptoGroupPreviewInput, 'pair' | 'productSeason' | 'horizon'>,
): string {
  return `${input.pair}:${input.productSeason}:${input.horizon}`
}

export function buildCryptoGroupPreview(input: CryptoGroupPreviewInput): {
  slug: string
  seasonKey: string
} {
  const slug = cryptoProductSlug(input)
  const seasonKey = cryptoSeasonKey(input)
  return { slug, seasonKey }
}
