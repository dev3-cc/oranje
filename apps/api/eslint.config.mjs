import config from '@oranje/config/eslint'

export default [
  ...config,
  {
    // Un test unitario prueba una clase concreta, no la superficie pública del
    // módulo. Obligarlo a entrar por el index.ts arrastraría todo el grafo de
    // inyección del módulo para probar una función.
    files: ['test/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
]
