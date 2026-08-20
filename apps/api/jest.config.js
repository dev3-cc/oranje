// Los specs viven en test/, no en src/: tsconfig.build.json compila src
// completo y terminarían dentro de dist.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testRegex: 'test/(?!integration/).*\\.spec\\.ts$',

  // Los imports llevan sufijo .js por NodeNext; Jest resuelve sobre los .ts
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
    // jose v6 se publica solo como ESM. En runtime Node lo resuelve solo
    // (require de ESM funciona desde Node 22), pero Jest tiene su propio
    // registro de módulos y necesita que se lo transpilen
    '^.+\\.js$': ['ts-jest', { tsconfig: { allowJs: true, module: 'CommonJS' } }],
  },

  // pnpm anida los paquetes en `.pnpm/<nombre>@<version>/node_modules/<nombre>`,
  // así que el patrón tiene que excluir las dos apariciones de `node_modules`
  transformIgnorePatterns: ['/node_modules/(?!\\.pnpm/jose@|jose/)'],
}
