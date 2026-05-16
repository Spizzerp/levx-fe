export type ProfileSearchParams = {
  wallet?: string
}

const BASE58_WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export function validateProfileSearch(search: Record<string, unknown>): ProfileSearchParams {
  const wallet = typeof search.wallet === 'string' ? search.wallet.trim() : ''
  return { wallet: BASE58_WALLET_RE.test(wallet) ? wallet : undefined }
}

export function resolveProfileTargetWallet(args: {
  searchStr: string
  validatedWallet: string | undefined
  connectedWallet: string | null
}): string | null {
  const { searchStr, validatedWallet, connectedWallet } = args
  if (validatedWallet) return validatedWallet

  // If the URL explicitly asked for `wallet=...` but validation rejected it,
  // do not silently fall back to the connected wallet's editable profile.
  const rawSearch = searchStr.startsWith('?') ? searchStr.slice(1) : searchStr
  return new URLSearchParams(rawSearch).has('wallet') ? null : connectedWallet
}
