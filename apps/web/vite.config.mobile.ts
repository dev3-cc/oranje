import { readFileSync, renameSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { lingui } from '@lingui/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig, type Plugin } from 'vite'

/**
 * El build de la app EMPAQUETADA del Colaborador (Capacitor → Android / iOS).
 *
 * Es un config aparte y NO una variante del de la web a propósito: el web es
 * un artefacto estático servido por Firebase Hosting (D-04) y su configuración
 * no debe moverse por una necesidad del móvil. Lo único que comparten es el
 * `src/`.
 *
 * Fuera de la entrada y el destino, TODO lo demás es idéntico al de la web —
 * mismos plugins, mismos alias, misma raíz. La app es la web dentro de un
 * WebView: cada divergencia aquí aparece como un defecto visual en el teléfono.
 *
 * En particular la raíz NO se cambia, y eso cuesta el renombrado de abajo.
 * Ponerla en `mobile/` daba un `index.html` gratis, pero **Tailwind 4 escanea
 * desde la raíz de Vite**: con la raíz ahí, solo veía ese archivo y emitía 180
 * reglas en vez de 219. Clases como `bg-surface-2` y `min-h-screen` no se
 * generaban y el login salía sin fondo y a media altura.
 */

const { version } = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string }

const outDir = fileURLToPath(new URL('./dist-mobile', import.meta.url))

/**
 * Vite emite el html con el nombre de su entrada (`index.mobile.html`) y
 * Capacitor exige `index.html` en la raíz del `webDir`. Se renombra al cerrar.
 */
function renameEntryToIndex(): Plugin {
  return {
    name: 'oranje-rename-mobile-entry',
    closeBundle() {
      renameSync(`${outDir}/index.mobile.html`, `${outDir}/index.html`)
    },
  }
}

export default defineConfig({
  plugins: [
    react({ plugins: [['@lingui/swc-plugin', {}]] }),
    lingui(),
    tailwindcss(),
    renameEntryToIndex(),
  ],
  assetsInclude: ['**/*.lottie'],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
    },
  },
  build: {
    outDir,
    emptyOutDir: true,
    /* El .apk/.ipa no sirve sourcemaps y pesan. */
    sourcemap: false,
    rollupOptions: {
      input: fileURLToPath(new URL('./index.mobile.html', import.meta.url)),
    },
  },
})
