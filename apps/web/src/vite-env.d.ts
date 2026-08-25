/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  readonly VITE_USE_MOCKS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __APP_VERSION__: string

declare module '*.lottie' {
  const src: string
  export default src
}
