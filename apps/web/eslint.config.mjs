import config from '@oranje/config/eslint'

export default [
  ...config,
  {
    rules: {
      /**
       * §4: una feature se importa SOLO desde su index.ts.
       * Prohibido `@/features/requisitions/components/RequisitionCard`.
       * Si dos features necesitan el mismo componente, sube a shared/components/.
       */
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/*'],
              message: 'Una feature se importa por su index.ts, no por dentro (§4).',
            },
            {
              group: ['@oranje/*/src/*', '@oranje/*/dist/*'],
              message: 'Un paquete del workspace se importa por su nombre, no por su ruta interna.',
            },
          ],
        },
      ],
    },
  },
]
