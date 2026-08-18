import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/** La versión visible del sistema es la del propio paquete: una sola fuente. */
const { version } = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      // §7.4: rutas absolutas con alias, prohibido `../../../`
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Alias interno de @oranje/ui — se consume por fuente (ver su tsconfig)
      '@ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
    },
  },
  /**
   * `strictPort` a propósito: sin él, si el 5173 está ocupado Vite se pasa al
   * 5174 sin avisar. La key de Google Maps está restringida por referrer a un
   * puerto concreto, así que el mapa se caería con RefererNotAllowedMapError y
   * sin causa aparente. Mejor que falle el arranque y se vea el motivo.
   */
  server: { port: 5173, strictPort: true },
  build: {
    // D-04: artefacto estático detrás del Load Balancer, sin servidor
    outDir: 'dist',
    sourcemap: true,
  },
})
