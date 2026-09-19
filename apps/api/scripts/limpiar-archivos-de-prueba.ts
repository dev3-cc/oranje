import 'dotenv/config'

import { Storage } from '@google-cloud/storage'

/**
 * Borra del bucket SOLO las rutas que se le pasan.
 *
 *   pnpm files:clean workers/document/abc.pdf operations/punch/def.webp
 *
 * NUNCA hace `getFiles()` sin filtro. El 2026-08-29 un script de limpieza lo
 * hizo y se llevó las fotos reales del personal que otra sesión había subido:
 * el bucket de desarrollo no es de una sola corrida, y no tiene versionado.
 *
 * Quien sube algo en una prueba se queda con su ruta y la pasa aquí. Si no la
 * tiene, no hay nada que borrar sin riesgo.
 */

const paths = process.argv.slice(2)

async function main(): Promise<void> {
  if (paths.length === 0) {
    throw new Error('Pásame las rutas a borrar. Sin argumentos no borro nada.')
  }

  const bucket = new Storage().bucket(process.env['STORAGE_BUCKET'] as string)

  for (const path of paths) {
    await bucket.file(path).delete({ ignoreNotFound: true })
    process.stdout.write(`  borrado ${path}\n`)
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`)
  process.exitCode = 1
})
