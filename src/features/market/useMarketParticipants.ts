import { useQuery } from '@tanstack/react-query'

import { getSupabase } from '@/lib/supabase/client'
import type { MarketParticipant } from '@/lib/supabase/types'

export interface MarketParticipantsResult {
  participants: MarketParticipant[]
  totalParticipants: number
}

type MarketParticipantRow = {
  market_id?: number | string
  wallet?: string
  collateral?: number | string
  exposure?: number | string
  pnl?: number | string
  positions?: number | string
  updated_at?: string
}

const MARKET_PARTICIPANT_COLUMNS = [
  'market_id',
  'wallet',
  'collateral',
  'exposure',
  'pnl',
  'positions',
  'updated_at',
].join(', ')

function numeric(value: number | string | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function participantFromRow(row: MarketParticipantRow): MarketParticipant {
  return {
    market_id: numeric(row.market_id),
    wallet: row.wallet ?? '',
    collateral: numeric(row.collateral),
    exposure: numeric(row.exposure),
    pnl: numeric(row.pnl),
    positions: numeric(row.positions),
    updated_at: row.updated_at ?? '',
  }
}

export async function getMarketParticipants(
  marketId: number,
  limit = 5,
): Promise<MarketParticipantsResult> {
  const { data, error, count } = await getSupabase()
    .from('market_participants')
    .select(MARKET_PARTICIPANT_COLUMNS, { count: 'exact' })
    .eq('market_id', marketId)
    .order('exposure', { ascending: false })
    .order('collateral', { ascending: false })
    .order('wallet', { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)

  const participants = ((data ?? []) as MarketParticipantRow[])
    .map(participantFromRow)
    .filter((participant) => participant.wallet.length > 0)

  return {
    participants,
    totalParticipants: count ?? participants.length,
  }
}

export function useMarketParticipants(marketId: number | null) {
  return useQuery<MarketParticipantsResult>({
    queryKey: ['supabase', 'marketParticipants', marketId],
    enabled: marketId != null,
    queryFn: () => getMarketParticipants(marketId!),
    staleTime: 60_000,
    refetchInterval: false,
  })
}
