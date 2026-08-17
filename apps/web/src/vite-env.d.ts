/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  /**
   * Key de Maps JavaScript API. Es PÚBLICA por diseño (D-17): viaja en el
   * bundle y se protege restringiéndola por referrer HTTP en la consola de GCP,
   * no con Secret Manager.
   */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  /**
   * `'true'` resuelve las peticiones contra los fixtures locales en vez de
   * llamar a la API. Andamio temporal mientras `apps/api` no expone los
   * endpoints; se apaga y el front queda apuntando al backend real.
   */
  readonly VITE_USE_MOCKS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
