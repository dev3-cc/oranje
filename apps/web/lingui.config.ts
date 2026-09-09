import { defineConfig } from '@lingui/cli'
import { formatter } from '@lingui/format-po'

/**
 * D-36: el ESPAÑOL es la fuente y vive literal en los componentes; el inglés
 * se redacta en `src/locales/en/messages.po` con el contexto que la extracción
 * deja (archivo, línea, comentario). `pnpm i18n:extract` actualiza los .po.
 */
export default defineConfig({
  sourceLocale: 'es',
  locales: ['es', 'en'],
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['<rootDir>/src'],
      exclude: ['**/*.spec.ts', '**/*.spec.tsx', '**/node_modules/**'],
    },
  ],
  // Sin números de línea: el diff del .po no cambia cada vez que se mueve una línea.
  format: formatter({ lineNumbers: false }),
})
