import { I18nProvider } from '@lingui/react'
import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router'

import { i18n } from './i18n'
import { router } from './router'
import { store } from './store'

export function AppProviders({ children }: { children?: ReactNode }): ReactNode {
  return (
    <I18nProvider i18n={i18n}>
      <Provider store={store}>{children ?? <RouterProvider router={router} />}</Provider>
    </I18nProvider>
  )
}
