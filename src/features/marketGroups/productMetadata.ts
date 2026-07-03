export type CryptoGroupPreviewInput = {
  pair: string
  productSeason: string
  horizon: string
  displayName: string
  description: string
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

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function buildCryptoGroupPreview(input: CryptoGroupPreviewInput): Promise<{
  slug: string
  seasonKey: string
  groupKeyHash: string
  metadataHash: string
}> {
  const slug = cryptoProductSlug(input)
  const seasonKey = cryptoSeasonKey(input)
  const [groupKeyHash, metadataHash] = await Promise.all([
    sha256Hex(seasonKey),
    sha256Hex(
      JSON.stringify({
        category: 'crypto',
        description: input.description,
        display_name: input.displayName,
        horizon: input.horizon,
        pair: input.pair,
        product_season: input.productSeason,
        slug,
      }),
    ),
  ])
  return { slug, seasonKey, groupKeyHash, metadataHash }
}
