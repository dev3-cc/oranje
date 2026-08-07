/**
 * Conventional Commits — Estándares de Desarrollo §1.
 * El alcance es el módulo de D-01 o la app: feat(demand):, fix(timesheet):, chore(web):
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'chore', 'build', 'ci'],
    ],

    /**
     * La §1 pide "descripción en minúscula", o sea: no arrancar con mayúscula.
     * `lower-case` a secas sería más estricto que el estándar y prohibiría los
     * nombres propios — NestJS, Prisma, Postgres, RTK Query. Lo que se prohíbe
     * es la mayúscula inicial, no las mayúsculas del producto.
     */
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 72],
  },
}
