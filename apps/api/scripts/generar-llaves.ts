/**
 * Genera el par RSA con el que se firman los tokens en staging y producción.
 *
 *   pnpm -F @oranje/api auth:keys
 *
 * Imprime las dos llaves en una línea cada una, con los saltos escapados, que es
 * como las acepta un `.env` y como las devuelve Secret Manager.
 *
 * La privada NO se commitea y no se comparte: en la nube vive en Secret Manager
 * (D-07) y se inyecta como variable. Cada ambiente lleva su propio par — si
 * staging y producción compartieran llave, un token de staging valdría en
 * producción.
 */
import { generateKeyPairSync } from 'node:crypto'

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})

const enUnaLinea = (pem: string): string => pem.trim().replace(/\n/g, '\\n')

process.stdout.write(`JWT_PRIVATE_KEY="${enUnaLinea(privateKey)}"\n`)
process.stdout.write(`JWT_PUBLIC_KEY="${enUnaLinea(publicKey)}"\n`)
