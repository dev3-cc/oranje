import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import importX from 'eslint-plugin-import-x'

/**
 * Config compartida — Estándares de Desarrollo §9.
 * Las reglas de esta lista BLOQUEAN el merge:
 *   sin imports relativos que suban de nivel · sin variables sin usar ·
 *   sin console.log · orden de imports · sin dependencias circulares.
 */
export default tseslint.config(
  { ignores: ['**/dist/**', '**/build/**', '**/coverage/**', '**/*.config.*'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    plugins: { 'import-x': importX },
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      // `any` prohibido salvo justificación comentada (§9)
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // sin console.log en código que se mergea (§7)
      'no-console': 'error',

      /**
       * Una feature se importa solo desde su index.ts (§4).
       *
       * Antes la regla era `['../*']` — prohibir TODO import que suba de nivel.
       * Eso no se puede cumplir dentro de una app: un módulo de negocio tiene
       * que llegar a `infra/prisma` para consultar la base, y `apps/api` no
       * tiene alias propio (TypeScript 7 eliminó `baseUrl`, y los `paths` de
       * `tsconfig.base.json` son solo para `@oranje/*`).
       *
       * Lo que de verdad importa no es subir de nivel: es **entrar por dentro**
       * de otra feature. Eso es lo que se bloquea ahora.
       *
       *   ../../infra/prisma/index.js          sí
       *   ../../infra/prisma/prisma.service.js NO — sáltate el index y el día
       *                                        que cambie la estructura interna
       *                                        rompes a todos los que entraron
       */
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/modules/*/*', '!**/modules/*/index.js'],
              message: 'Una feature de modules/ se importa por su index.ts, no por dentro (§4).',
            },
            {
              group: ['**/infra/*/*', '!**/infra/*/index.js'],
              message: 'infra/ se importa por su index.ts, no por dentro (§4).',
            },
            {
              group: ['@oranje/*/src/*', '@oranje/*/dist/*'],
              message: 'Un paquete del workspace se importa por su nombre, no por su ruta interna.',
            },
          ],
        },
      ],

      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import-x/no-cycle': 'error',
    },
  },
)
