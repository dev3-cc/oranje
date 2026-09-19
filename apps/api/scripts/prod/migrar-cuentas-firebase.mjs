// Copia las cuentas de Firebase Auth de un proyecto a otro CONSERVANDO la
// contraseña (2026-09-19). Las cuentas no viajan con la base: viven en el
// proyecto de Firebase, y prod es otro proyecto (oranje-prod).
//
// Cómo: Identity Toolkit exporta cada cuenta con su hash y su salt
// (accounts:batchGet) y la importa en el destino con los parámetros SCRYPT
// del origen (accounts:batchCreate). El uid se conserva, así que
// identity.user.firebase_uid clonado con la base sigue apuntando bien.
// Las que ya existan en destino (mismo correo) se saltan.
//
// Uso: node scripts/prod/migrar-cuentas-firebase.mjs <origen> <destino>
// Necesita ADC con permiso de dueño en los dos proyectos (gcloud auth
// application-default login). Nada de esto se imprime ni se guarda.
import { GoogleAuth } from 'google-auth-library'

// El tercer argumento (opcional) es un archivo con un correo por línea: solo
// esas cuentas se importan. Sirve para no arrastrar las cuentas de prueba que
// la limpieza ya sacó de la base.
import { readFileSync } from 'node:fs'

const [origen, destino, archivoCorreos] = process.argv.slice(2)
if (!origen || !destino) {
  console.error(
    'uso: migrar-cuentas-firebase.mjs <proyecto-origen> <proyecto-destino> [correos.txt]',
  )
  process.exit(1)
}
const permitidos = archivoCorreos
  ? new Set(
      readFileSync(archivoCorreos, 'utf8')
        .split('\n')
        .map((l) => l.trim().toLowerCase())
        .filter(Boolean),
    )
  : null

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] })
const token = await auth.getAccessToken()

async function llamar(proyecto, metodo, url, body) {
  const res = await fetch(url, {
    method: metodo,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-goog-user-project': proyecto,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok)
    throw new Error(`${metodo} ${url}: ${JSON.stringify(json.error ?? json).slice(0, 300)}`)
  return json
}

const ADMIN = 'https://identitytoolkit.googleapis.com/admin/v2'
const V1 = 'https://identitytoolkit.googleapis.com/v1'

// 1) Los parámetros de hash del origen (solo los ve un dueño del proyecto).
const config = await llamar(origen, 'GET', `${ADMIN}/projects/${origen}/config`)
const hash = config.signIn?.hashConfig
if (!hash?.signerKey) throw new Error('El origen no expone signIn.hashConfig: hace falta ser dueño')

// 2) Todas las cuentas del origen, por páginas.
const cuentas = []
let pageToken
do {
  const page = await llamar(
    origen,
    'GET',
    `${V1}/projects/${origen}/accounts:batchGet?maxResults=1000${pageToken ? `&nextPageToken=${pageToken}` : ''}`,
  )
  cuentas.push(...(page.users ?? []))
  pageToken = page.nextPageToken
} while (pageToken)
console.log(`origen ${origen}: ${cuentas.length} cuentas`)

// 3) Las que ya existen en destino se saltan (por correo).
const existentes = new Set()
pageToken = undefined
do {
  const page = await llamar(
    destino,
    'GET',
    `${V1}/projects/${destino}/accounts:batchGet?maxResults=1000${pageToken ? `&nextPageToken=${pageToken}` : ''}`,
  )
  for (const u of page.users ?? []) if (u.email) existentes.add(u.email.toLowerCase())
  pageToken = page.nextPageToken
} while (pageToken)

const pendientes = cuentas.filter(
  (u) =>
    u.email &&
    !existentes.has(u.email.toLowerCase()) &&
    (permitidos === null || permitidos.has(u.email.toLowerCase())),
)
if (permitidos) console.log(`filtro: ${permitidos.size} correos permitidos`)
console.log(
  `destino ${destino}: ${existentes.size} ya existían · ${pendientes.length} por importar`,
)

// 4) Importar en lotes con los mismos uid, hash y salt.
let importadas = 0
const errores = []
for (let i = 0; i < pendientes.length; i += 500) {
  const lote = pendientes.slice(i, i + 500).map((u) => ({
    localId: u.localId,
    email: u.email,
    emailVerified: u.emailVerified ?? false,
    displayName: u.displayName,
    photoUrl: u.photoUrl,
    passwordHash: u.passwordHash,
    salt: u.salt,
    disabled: u.disabled ?? false,
  }))
  const res = await llamar(destino, 'POST', `${V1}/projects/${destino}/accounts:batchCreate`, {
    hashAlgorithm: hash.algorithm,
    signerKey: hash.signerKey,
    saltSeparator: hash.saltSeparator,
    rounds: hash.rounds,
    memoryCost: hash.memoryCost,
    users: lote,
  })
  errores.push(...(res.error ?? []).map((e) => `${lote[e.index]?.email}: ${e.message}`))
  importadas += lote.length - (res.error?.length ?? 0)
}
console.log(`importadas: ${importadas} · con error: ${errores.length}`)
for (const e of errores) console.log('  ', e)
