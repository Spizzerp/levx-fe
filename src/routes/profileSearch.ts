export type ProfileSearchParams = {
  wallet?: string
}

const BASE58_WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export function validateProfileSearch(search: Record<string, unknown>): ProfileSearchParams {
  const wallet = typeof search.wallet === 'string' ? search.wallet.trim() : ''
  return { wallet: BASE58_WALLET_RE.test(wallet) ? wallet : undefined }
}
