import '@fontsource-variable/montserrat'
import 'material-icons/iconfont/round.css'
import 'material-icons/iconfont/outlined.css'
import '../styles/globals.css'

import { I18nProvider } from '@lingui/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router'

import { installNativeApiFetch } from './nativeApiFetch'
import { installNativeDownloads } from './nativeDownloads'
import { installNativeHotelPhotos } from './nativeHotelPhotos'
import { mobileRouter } from './router'

import { i18n } from '@/app/i18n'
import { store } from '@/app/store'

/*
 * Los providers se componen AQUÍ y no se reusa `app/providers.tsx`: aquel monta
 * el `router` del web, y la app tiene el suyo (`mobile/router.tsx`). Las
 * pantallas del staff que ve el hotel son las mismas del web: las rutas se
 * comparten desde `app/staffRoutes.tsx`, no el router.
 */

/* En iOS, el API por el HTTP nativo: la cookie del refresh no sobrevive en el
   WKWebView (ver `nativeApiFetch.ts`). Antes de montar, para que la primera
   petición —el refresh del arranque— ya salga por ahí. */
installNativeApiFetch(import.meta.env.VITE_API_URL)

/* En iOS, las fotos de hotel de Google por el HTTP nativo con el referrer de la
   web: con el origen `capacitor://` Google las rechaza (ver `nativeHotelPhotos.ts`). */
installNativeHotelPhotos()

/* «Descargar QR»: la hoja se abre en la app y el PDF va a la hoja de compartir
   del sistema; el WebView no descarga archivos (ver `nativeDownloads.ts`). */
installNativeDownloads((path) => {
  void mobileRouter.navigate(path)
})

const container = document.getElementById('root')
if (!container) throw new Error('Falta #root en index.html')

createRoot(container).render(
  <StrictMode>
    <I18nProvider i18n={i18n}>
      <Provider store={store}>
        {/* Los avisos (`toast`) los monta cada rama del router: `WithToaster`
            fuera del shell y el `AppShell` del web dentro. Uno aquí los duplicaba. */}
        <RouterProvider router={mobileRouter} />
      </Provider>
    </I18nProvider>
  </StrictMode>,
)
