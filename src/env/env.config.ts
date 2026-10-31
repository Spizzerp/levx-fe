function requireEnv(key: string): string {
  const val = import.meta.env[key]
  if (!val) throw new Error(`[env] Required variable ${key} is missing`)
  return val
}

function readPriceSource(): AppEnv['APP_PRICE_SOURCE'] {
  // Unset or empty means the default, as requireEnv treats an empty value as missing
  const val = import.meta.env.APP_PRICE_SOURCE || 'free'
  if (val !== 'free' && val !== 'pyth') {
    throw new Error('[env] APP_PRICE_SOURCE must be "free" or "pyth"')
  }
  return val
}

function readHermesUrl(priceSource: AppEnv['APP_PRICE_SOURCE']): string {
  const val = import.meta.env.APP_HERMES_URL ?? ''
  if (priceSource === 'pyth' && !val) {
    throw new Error('[env] Required variable APP_HERMES_URL is missing (APP_PRICE_SOURCE=pyth)')
  }
  return val
}

export type AppEnv = {
  APP_ENV: string
  APP_API_BASE_URL: string
  APP_PRICE_SOURCE: 'free' | 'pyth'
  APP_HERMES_URL: string
  APP_RPC_URL: string
  APP_NETWORK: 'devnet' | 'mainnet'
  APP_PROGRAM_ID: string
  APP_ADMIN_WALLETS: string[]
  APP_PATH_UPLOAD_RELAY_FEE_LAMPORTS: number
  APP_EIGENCACHE_QUOTES_ENABLED: boolean
  APP_SUPABASE_URL: string
  APP_SUPABASE_ANON_KEY: string
}

const priceSource = readPriceSource()

export const env: AppEnv = {
  APP_ENV: import.meta.env.APP_ENV ?? 'local',
  APP_API_BASE_URL: import.meta.env.APP_API_BASE_URL ?? '',
  APP_PRICE_SOURCE: priceSource,
  APP_HERMES_URL: readHermesUrl(priceSource),
  APP_RPC_URL: requireEnv('APP_RPC_URL'),
  APP_NETWORK: requireEnv('APP_NETWORK') as AppEnv['APP_NETWORK'],
  APP_PROGRAM_ID: requireEnv('APP_PROGRAM_ID'),
  APP_ADMIN_WALLETS: (import.meta.env.APP_ADMIN_WALLETS ?? '').split(',').map((s: string) => s.trim()).filter(Boolean),
  APP_PATH_UPLOAD_RELAY_FEE_LAMPORTS: Number(import.meta.env.APP_PATH_UPLOAD_RELAY_FEE_LAMPORTS ?? 50_000),
  APP_EIGENCACHE_QUOTES_ENABLED:
    (import.meta.env.APP_EIGENCACHE_QUOTES_ENABLED ??
      import.meta.env.VITE_EIGENCACHE_QUOTES_ENABLED ??
      'false') === 'true',
  APP_SUPABASE_URL: requireEnv('APP_SUPABASE_URL'),
  APP_SUPABASE_ANON_KEY: requireEnv('APP_SUPABASE_ANON_KEY'),
}
