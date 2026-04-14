import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'

import { AdminPage } from '@/routes/pages/AdminPage'
import { AdminMarketsPage } from '@/routes/pages/AdminMarketsPage'
import { LabsChartPage } from '@/routes/pages/LabsChartPage'
import { LeaderboardPage } from '@/routes/pages/LeaderboardPage'
import { MarketPage } from '@/routes/pages/MarketPage'
import { MarketsPage } from '@/routes/pages/MarketsPage'
import { NotFoundPage } from '@/routes/pages/NotFoundPage'
import { PortfolioPage } from '@/routes/pages/PortfolioPage'
import { PositionsPage } from '@/routes/pages/PositionsPage'
import { VaultPage } from '@/routes/pages/VaultPage'
import { RootRouteComponent } from '@/routes/RootRoute'

const rootRoute = createRootRoute({
  component: RootRouteComponent,
  notFoundComponent: NotFoundPage,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/markets' })
  },
})

const marketsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/markets',
  component: MarketsPage,
})

const marketRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/market/$id',
  component: MarketPage,
})

const positionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/positions',
  component: PositionsPage,
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

const leaderboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/leaderboard',
  component: LeaderboardPage,
})

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminMarketsPage,
})

const adminCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/create',
  component: AdminPage,
})

const labsChartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/labs/chart',
  component: LabsChartPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  marketsRoute,
  marketRoute,
  positionsRoute,
  vaultRoute,
  portfolioRoute,
  leaderboardRoute,
  adminRoute,
  adminCreateRoute,
  labsChartRoute,
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
