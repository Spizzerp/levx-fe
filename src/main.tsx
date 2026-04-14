import './polyfills'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'

import { queryClient } from '@/api/api.config'
import { initEnv } from '@/env'
import { router } from '@/routes/router'
import '@/style/app.css'
import { UIRoot } from '@/ui/UIRoot'

initEnv()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <UIRoot>
        <RouterProvider router={router} />
      </UIRoot>
    </QueryClientProvider>
  </StrictMode>,
)
