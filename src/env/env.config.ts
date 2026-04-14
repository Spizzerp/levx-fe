function requireEnv(key: string): string {
  const val = import.meta.env[key]
  if (!val) throw new Error(`[env] Required variable ${key} is missing`)
  return val
}

export type AppEnv = {
  APP_ENV: string
  APP_API_BASE_URL: string
  APP_HERMES_URL: string
  APP_RPC_URL: string
  APP_NETWORK: 'devnet' | 'mainnet'
  APP_PROGRAM_ID: string
  APP_ADMIN_WALLETS: string[]
}

export const env: AppEnv = {
  APP_ENV: import.meta.env.APP_ENV ?? 'local',
  APP_API_BASE_URL: import.meta.env.APP_API_BASE_URL ?? '',
  APP_HERMES_URL: requireEnv('APP_HERMES_URL'),
  APP_RPC_URL: requireEnv('APP_RPC_URL'),
  APP_NETWORK: requireEnv('APP_NETWORK') as AppEnv['APP_NETWORK'],
  APP_PROGRAM_ID: requireEnv('APP_PROGRAM_ID'),
  APP_ADMIN_WALLETS: (import.meta.env.APP_ADMIN_WALLETS ?? '').split(',').map((s: string) => s.trim()).filter(Boolean),
}
