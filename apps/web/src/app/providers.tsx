import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router'

import { router } from './router'
import { store } from './store'

export function AppProviders({ children }: { children?: ReactNode }): ReactNode {
  return <Provider store={store}>{children ?? <RouterProvider router={router} />}</Provider>
}
