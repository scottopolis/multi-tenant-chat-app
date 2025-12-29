import { createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { routerWithQueryClient } from '@tanstack/react-router-with-query'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexProvider } from 'convex/react'

import { routeTree } from './routeTree.gen'
import { TenantProvider } from './lib/tenant'

export function getRouter() {
  const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL!
  if (!CONVEX_URL) {
    console.error('missing envar VITE_CONVEX_URL')
  }
  const convexQueryClient = new ConvexQueryClient(CONVEX_URL)

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  })
  convexQueryClient.connect(queryClient)

  const router = routerWithQueryClient(
    createRouter({
      routeTree,
      defaultPreload: 'intent',
      context: { queryClient },
      scrollRestoration: true,
      defaultNotFoundComponent: () => <div className="p-8 text-center"><h1 className="text-2xl font-bold">404 - Page Not Found</h1></div>,
      Wrap: ({ children }) => (
        <ConvexProvider client={convexQueryClient.convexClient}>
          <TenantProvider>{children}</TenantProvider>
        </ConvexProvider>
      ),
    }),
    queryClient
  )

  return router
}
