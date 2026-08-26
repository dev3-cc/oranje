// Las pruebas de integración necesitan la base: corren contra la instancia real
// por el proxy, con MIGRATE_DATABASE_URL. Config aparte para que `pnpm test`
// —que es lo que corre CI, sin base— siga siendo solo unitario.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testRegex: 'test/integration/.*\\.spec\\.ts$',
  setupFiles: ['dotenv/config'],
  testTimeout: 30_000,
  maxWorkers: 1,
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
    // uuid v14 se publica solo como ESM, igual que jose. Node lo resuelve solo;
    // Jest tiene su propio registro de modulos y necesita que se lo transpilen.
    '^.+\\.js$': ['ts-jest', { tsconfig: { allowJs: true, module: 'CommonJS' } }],
  },
  transformIgnorePatterns: ['/node_modules/(?!\\.pnpm/(jose|uuid)@|jose/|uuid/)'],
}
