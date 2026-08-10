/**
 * Estándares de Desarrollo §9: el CI corre `pnpm test` y bloquea el merge.
 * Sin esta configuración, `jest` arrancaba sin transformador de TypeScript y
 * el paso de tests fallaba aunque no hubiera nada roto.
 *
 * Los specs viven en `test/`, no en `src/`: `tsconfig.build.json` compila
 * `src/**` completo y los tests terminarían dentro de `dist`.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testRegex: 'test/.*\\.spec\\.ts$',

  /**
   * Los imports llevan sufijo `.js` porque el proyecto resuelve como NodeNext.
   * Jest resuelve sobre los `.ts` del fuente, así que hay que quitárselo.
   */
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
}
