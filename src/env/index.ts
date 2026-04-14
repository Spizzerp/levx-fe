import type { Cluster } from '@solana/web3.js'
import { env } from './env.config'

export function initEnv() {
  if (!env.APP_API_BASE_URL) {
    console.info('[env] APP_API_BASE_URL is not set. Relative API paths will be used.')
  }
}

/**
 * Map our APP_NETWORK convention ('devnet' | 'mainnet') to Solana's
 * clusterApiUrl Cluster argument ('devnet' | 'mainnet-beta').
 */
export function toSolanaCluster(network: typeof env.APP_NETWORK): Cluster {
  return network === 'mainnet' ? 'mainnet-beta' : 'devnet'
}

export { env }
