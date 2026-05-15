import { useMemo } from 'react'

import { AvatarCircles, type AvatarCircle } from '@/ui/AvatarCircles'
import { SIGILS } from '@/ui/Sigils'
import { cn } from '@/lib/cn'
import { getProfileImageUrl, useProfiles } from '@/lib/supabase/hooks'
import { useMarketTopTraders } from '@/features/market/useMarketTopTraders'
import type { Profile } from '@/lib/supabase/types'

const MAX_VISIBLE_AVATARS = 5

interface MarketParticipantAvatarsProps {
  marketIdNum: number
  traderCount: number
  className?: string
}

function shortWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`
}

function deterministicSigil(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0
  return Math.abs(h) % SIGILS.length
}

function displayNameFor(wallet: string, profile?: Profile): string {
  return profile?.display_name || profile?.username || shortWallet(wallet)
}

function profileImageFor(profile?: Profile): string | null {
  if (profile?.avatar_kind !== 'image') return null
  return getProfileImageUrl(profile.avatar_image_path)
}

function sigilAvatar(seed: string, profile?: Profile) {
  const idx =
    profile?.avatar_kind === 'sigil'
      ? profile.avatar_sigil_idx
      : deterministicSigil(seed)
  const Glyph = SIGILS[idx] ?? SIGILS[0]
  return <Glyph size={20} tone="strong" />
}

export function MarketParticipantAvatars({
  marketIdNum,
  traderCount,
  className,
}: MarketParticipantAvatarsProps) {
  const { data: topTraders } = useMarketTopTraders(traderCount > 0 ? marketIdNum : null)

  const knownWallets = useMemo(() => {
    return (topTraders ?? []).slice(0, MAX_VISIBLE_AVATARS).map((trader) => trader.wallet)
  }, [topTraders])

  const { data: profileMap } = useProfiles(knownWallets)

  const avatars = useMemo<AvatarCircle[]>(() => {
    const traderByWallet = new Map((topTraders ?? []).map((trader) => [trader.wallet, trader]))
    return knownWallets.map((wallet) => {
      const profile = profileMap?.[wallet]
      const trader = traderByWallet.get(wallet)
      return {
        id: wallet,
        label: displayNameFor(wallet, profile),
        wallet,
        username: profile?.username,
        pnl: trader?.pnl ?? 0,
        imageUrl: profileImageFor(profile),
        fallback: sigilAvatar(wallet, profile),
      }
    })
  }, [knownWallets, profileMap, topTraders])

  if (traderCount <= 0 || avatars.length === 0) return null

  const totalParticipants = topTraders?.length ?? traderCount
  const overflowCount = Math.max(0, totalParticipants - avatars.length)

  return (
    <AvatarCircles
      avatars={avatars}
      numPeople={overflowCount}
      className={cn('justify-end', className)}
    />
  )
}
