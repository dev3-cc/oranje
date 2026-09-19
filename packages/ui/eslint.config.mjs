import config from '@oranje/config/eslint'

export default [
  ...config,
  {
    // Excepción acotada de §7.1: las primitivas copiadas de shadcn conservan su
    // kebab-case para que `shadcn diff` siga detectando cambios al actualizar.
    files: ['src/components/ui/**'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
]
