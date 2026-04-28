import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'

import { AdminPage } from '@/routes/pages/AdminPage'
import { AdminMarketsPage } from '@/routes/pages/AdminMarketsPage'
import { DocsPage } from '@/routes/pages/DocsPage'
import { LabsChartPage } from '@/routes/pages/LabsChartPage'
import { LandingPage } from '@/routes/pages/LandingPage'
import { LeaderboardPage } from '@/routes/pages/LeaderboardPage'
import { MarketPage } from '@/routes/pages/MarketPage'
import { MarketsPage } from '@/routes/pages/MarketsPage'
import { NotFoundPage } from '@/routes/pages/NotFoundPage'
import { PortfolioPage } from '@/routes/pages/PortfolioPage'
import { ProfilePage } from '@/routes/pages/ProfilePage'
import { VaultPage } from '@/routes/pages/VaultPage'
import { RootRouteComponent } from '@/routes/RootRoute'

const rootRoute = createRootRoute({
  component: RootRouteComponent,
  notFoundComponent: NotFoundPage,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
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
  component: ProfilePage,
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

const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs',
  component: DocsPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  marketsRoute,
  marketRoute,
  positionsRoute,
  vaultRoute,
  portfolioRoute,
  profileRoute,
  leaderboardRoute,
  adminRoute,
  adminCreateRoute,
  labsChartRoute,
  docsRoute,
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
