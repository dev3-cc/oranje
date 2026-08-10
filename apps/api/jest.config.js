// Los specs viven en test/, no en src/: tsconfig.build.json compila src
// completo y terminarían dentro de dist.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testRegex: 'test/.*\\.spec\\.ts$',

  // Los imports llevan sufijo .js por NodeNext; Jest resuelve sobre los .ts
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
}
