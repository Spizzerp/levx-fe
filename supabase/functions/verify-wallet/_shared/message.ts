/**
 * Canonical signing message. Sole source of truth — index.ts returns this in
 * /nonce responses, FE signs it verbatim, and /verify reconstructs it from the
 * stored nonce. Do NOT duplicate this string anywhere else.
 */
export function buildMessage(nonce: string): string {
  return `Sign to verify ownership of your wallet for LevX.\n\nNonce: ${nonce}\n\nThis is not a transaction and will not move funds.`
}
