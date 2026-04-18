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
