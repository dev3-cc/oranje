import '@fontsource-variable/montserrat'
import 'material-icons/iconfont/round.css'
import 'material-icons/iconfont/outlined.css'
import '../styles/globals.css'

import { I18nProvider } from '@lingui/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router'

import { mobileRouter } from './router'

import { i18n } from '@/app/i18n'
import { store } from '@/app/store'

/*
 * Los providers se componen AQUÍ y no se reusa `app/providers.tsx` a propósito:
 * aquel hace `import { router } from './router'` en el tope, y ese router monta
 * `AppShell`. Un import estático entra al bundle aunque la ruta sea
 * inalcanzable, así que reusarlo metería el sidebar y los 25 módulos del staff
 * en el .apk. La composición es de tres líneas; la duplicación sale más barata
 * que el arrastre.
 */

const container = document.getElementById('root')
if (!container) throw new Error('Falta #root en index.html')

createRoot(container).render(
  <StrictMode>
    <I18nProvider i18n={i18n}>
      <Provider store={store}>
        <RouterProvider router={mobileRouter} />
      </Provider>
    </I18nProvider>
  </StrictMode>,
)
