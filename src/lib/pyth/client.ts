import { HermesClient } from '@pythnetwork/hermes-client'
import { env } from '@/env/env.config'

let _client: HermesClient | null = null

export function getPythClient(): HermesClient {
  if (!_client) _client = new HermesClient(env.APP_HERMES_URL)
  return _client
}

/** Test-only: reset the singleton between test runs. */
export function __resetPythClientForTests(): void {
  _client = null
}
