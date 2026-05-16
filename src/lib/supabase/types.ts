export type Comment = {
  id:          string
  market_id:   string
  wallet:      string
  body:        string
  created_at:  string
  edited_at:   string | null
}

export type JWTRecord = {
  jwt:        string
  expiresAt:  number   // unix ms
  wallet:     string
}

export type DrawFrame = {
  wallet:     string
  points:     Array<{ time: number; value: number }>
  timestamp:  number
  done?:      boolean
}

export type AuthStatus = 'idle' | 'pending' | 'authenticated' | 'error'

export type ProfileAvatarKind = 'sigil' | 'image'

export type Profile = {
  user_id: string
  wallet_address: string
  wallet_name: string
  username: string
  display_name: string
  bio: string
  x_id: string
  avatar_kind: ProfileAvatarKind
  avatar_sigil_idx: number
  avatar_image_path: string | null
  created_at: string
  updated_at: string
}

export type MarketParticipant = {
  market_id: number
  wallet: string
  collateral: number
  exposure: number
  pnl: number
  positions: number
  updated_at: string
}
