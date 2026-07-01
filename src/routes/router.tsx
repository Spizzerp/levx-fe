import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'

import { AdminPage } from '@/routes/pages/AdminPage'
import {
  AdminMarketGroupsPage,
  AdminMarketsPage,
  AdminMode2GatePage,
} from '@/routes/pages/AdminMarketsPage'
import { DocsLayout } from '@/routes/pages/DocsPage'
import { LabsChartPage } from '@/routes/pages/LabsChartPage'
import { LandingPage } from '@/routes/pages/LandingPage'
import { LeaderboardPage } from '@/routes/pages/LeaderboardPage'
import { MarketGroupPage } from '@/routes/pages/MarketGroupPage'
import { MarketPage } from '@/routes/pages/MarketPage'
import { MarketsPage } from '@/routes/pages/MarketsPage'
import { NotFoundPage } from '@/routes/pages/NotFoundPage'
import { PortfolioPage } from '@/routes/pages/PortfolioPage'
import { ProfilePage } from '@/routes/pages/ProfilePage'
import { ProviderGatewayAdminPage } from '@/routes/pages/ProviderGatewayAdminPage'
import { ProviderGatewayLeaderboardPage } from '@/routes/pages/ProviderGatewayLeaderboardPage'
import { ProviderGatewayProviderPage } from '@/routes/pages/ProviderGatewayProviderPage'
import { VaultPage } from '@/routes/pages/VaultPage'
import { RootRouteComponent } from '@/routes/RootRoute'
import { DocsContent } from '@/modules/docs/DocsContent'
import { DocsHome } from '@/modules/docs/DocsHome'
import { isDocId } from '@/modules/docs/data'
import type { DocId } from '@/modules/docs/types'
import { validateProfileSearch } from '@/routes/profileSearch'

const rootRoute = createRootRoute({
  component: RootRouteComponent,
  notFoundComponent: NotFoundPage,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
})

export type MarketsSearchParams = {
  view?: 'table' | 'grid'
}

export type AdminCreateSearchParams = {
  group?: string
}

export const marketsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/markets',
  validateSearch: (search: Record<string, unknown>): MarketsSearchParams => {
    const view = search.view as string
    return {
      view: (view === 'grid' || view === 'table' ? view : undefined) as
        | 'table'
        | 'grid'
        | undefined,
    }
  },
  component: MarketsPage,
})

const marketRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/market/$id',
  component: MarketPage,
})

const marketGroupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/markets/group/$groupKeyHash',
  component: MarketGroupPage,
})

const positionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/positions',
  beforeLoad: () => {
    throw redirect({ to: '/portfolio' })
  },
})

const vaultRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/vault',
  component: VaultPage,
})

const portfolioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/portfolio',
  component: PortfolioPage,
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  validateSearch: validateProfileSearch,
  component: ProfilePage,
})

const leaderboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/leaderboard',
  component: LeaderboardPage,
})

const providersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/providers',
  component: ProviderGatewayLeaderboardPage,
})

const providerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/providers/$providerId',
  component: ProviderGatewayProviderPage,
})

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminMarketsPage,
})

const adminMarketGroupsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/market-groups',
  component: AdminMarketGroupsPage,
})

const adminMode2GateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/mode2-gate',
  component: AdminMode2GatePage,
})

const adminProvidersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/providers',
  component: ProviderGatewayAdminPage,
})

const adminCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/create',
  validateSearch: (search: Record<string, unknown>): AdminCreateSearchParams => ({
    group: typeof search.group === 'string' ? search.group : undefined,
  }),
  component: AdminPage,
})

const labsChartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/labs/chart',
  component: LabsChartPage,
})

const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs',
  component: DocsLayout,
})

const docsIndexRoute = createRoute({
  getParentRoute: () => docsRoute,
  path: '/',
  component: DocsHome,
})

const docsDocRoute = createRoute({
  getParentRoute: () => docsRoute,
  path: '$id',
  beforeLoad: ({ params }) => {
    if (!isDocId(params.id)) {
      throw redirect({
        to: '/docs/$id',
        params: { id: 'introduction' },
        replace: true,
      })
    }
  },
  component: function DocsDocPage() {
    const { id } = docsDocRoute.useParams()
    const doc: DocId = isDocId(id) ? id : 'introduction'
    return <DocsContent doc={doc} />
  },
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  marketsRoute,
  marketGroupRoute,
  marketRoute,
  positionsRoute,
  vaultRoute,
  portfolioRoute,
  profileRoute,
  leaderboardRoute,
  providersRoute,
  providerRoute,
  adminRoute,
  adminMarketGroupsRoute,
  adminMode2GateRoute,
  adminProvidersRoute,
  adminCreateRoute,
  labsChartRoute,
  docsRoute.addChildren([docsIndexRoute, docsDocRoute]),
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
