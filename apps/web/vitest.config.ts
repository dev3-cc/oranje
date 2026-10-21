import { fileURLToPath, URL } from 'node:url'

import { lingui } from '@lingui/vite-plugin'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react({ plugins: [['@lingui/swc-plugin', {}]] }), lingui()],
  assetsInclude: ['**/*.lottie'],
  resolve: {
    alias: {
      '@lottiefiles/dotlottie-react': fileURLToPath(
        new URL('./src/test/stubs/dotlottie-react.tsx', import.meta.url),
      ),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
    },
  },
  /* `__APP_VERSION__` lo define el build (vite.config.ts) y las pruebas no lo
     tenían: cualquier pantalla que lo use —el login, por ejemplo— reventaba
     con «is not defined» y no se podía probar. Por eso el login nunca tuvo
     spec (descubierto al escribir el del modal de idioma, 2026-10-20). */
  define: { __APP_VERSION__: JSON.stringify('test') },

  test: {
    environment: 'jsdom',
    /* 15 s y no los 5 por defecto.
       Estas pruebas montan pantallas completas sobre jsdom —router, store,
       Radix, formularios de cinco pasos— y cada caso tarda ~2 s en una máquina
       tranquila. Con carga (otro `vitest`, un servidor de desarrollo, una
       consulta a la base) cruzan los 5 s y fallan POR TIEMPO, no por un
       defecto: medido el 2026-10-19 en SelfPickPage, donde la misma versión
       daba 7 de 7 en una corrida y 3 fallos en la siguiente.
       El límite existe para atrapar una prueba COLGADA, no para medir qué tan
       ocupada está la máquina. */
    testTimeout: 15_000,
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    env: { VITE_USE_MOCKS: 'true', VITE_GOOGLE_MAPS_API_KEY: '' },
    coverage: {
      provider: 'v8',
      include: ['src/features/**', 'src/shared/**'],
    },
  },
})
