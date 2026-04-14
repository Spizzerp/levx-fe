import { describe, it } from 'vitest'

describe('WrongNetworkBanner', () => {
  it.todo('renders nothing when walletStore.wrongNetwork=false')
  it.todo('renders banner with role="alert" when walletStore.wrongNetwork=true')
  it.todo('banner label includes the expected cluster from APP_NETWORK')
  it.todo('banner is non-dismissable — no close button')
})
