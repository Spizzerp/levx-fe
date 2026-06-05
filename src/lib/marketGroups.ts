import { PublicKey } from '@solana/web3.js'

import type { MarketGroupKind, MarketGroupStatus } from '@/types/market'

export const DEFAULT_PUBKEY = new PublicKey('11111111111111111111111111111111')

export const MARKET_GROUP_KIND_OPTIONS: { value: MarketGroupKind; label: string }[] = [
  { value: 'root', label: 'Root' },
  { value: 'league', label: 'League' },
  { value: 'season', label: 'Season' },
  { value: 'game', label: 'Game' },
  { value: 'event', label: 'Event' },
  { value: 'assetSeason', label: 'Asset season' },
  { value: 'horizon', label: 'Horizon' },
  { value: 'custom', label: 'Custom' },
]

export const MARKET_GROUP_STATUS_OPTIONS: { value: MarketGroupStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'retired', label: 'Retired' },
]

export function normalizeBytes32Hex(input: string): string {
  const hex = input.trim().startsWith('0x') ? input.trim().slice(2) : input.trim()
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('Expected a 32-byte hex string')
  }
  return hex.toLowerCase()
}

export function bytes32HexToArray(input: string): number[] {
  const hex = normalizeBytes32Hex(input)
  return Array.from({ length: 32 }, (_, index) => parseInt(hex.slice(index * 2, index * 2 + 2), 16))
}

export function isBytes32Hex(input: string): boolean {
  try {
    normalizeBytes32Hex(input)
    return true
  } catch {
    return false
  }
}

export function anchorEnum(value: MarketGroupKind | MarketGroupStatus): Record<string, object> {
  return { [value]: {} }
}
