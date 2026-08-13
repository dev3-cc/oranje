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
       *   ../../infra/prisma/index.js          sí
       *   ../../infra/prisma/prisma.service.js no
       *
       * Antes la regla era `['../*']`, que prohibía TODO import hacia arriba y
       * dejaba a un módulo de negocio sin forma de llegar a `infra/prisma`.
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
