import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    /**
     * Entorno FIJO de pruebas: Vitest también carga los `.env`, así que sin esto
     * los tests dependen de la configuración local de quien los corre.
     *
     * - `VITE_USE_MOCKS`: contra los fixtures, nunca contra la red. Se queda
     *   encendida aunque `.env` la apague: un test unitario no debe depender de
     *   que el backend esté levantado.
     * - `VITE_GOOGLE_MAPS_API_KEY`: vacía a propósito. Cargar el SDK de Google
     *   en jsdom no aporta nada y falla; con la key vacía se ejercita la rama
     *   del aviso, que es la que sí se puede probar. Sin fijarla, los tests
     *   pasaban o fallaban según si el desarrollador tenía key en su
     *   `.env.local`.
     */
    env: { VITE_USE_MOCKS: 'true', VITE_GOOGLE_MAPS_API_KEY: '' },
    coverage: {
      provider: 'v8',
      // Estándares de Desarrollo §8: los componentes con estado se prueban
      include: ['src/features/**', 'src/shared/**'],
    },
  },
})
