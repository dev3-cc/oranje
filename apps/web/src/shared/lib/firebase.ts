import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, type Auth } from 'firebase/auth'

/**
 * Firebase Auth es la autoridad de identidad (D-05).
 * Los PERMISOS no viven aquí: se resuelven en el backend contra
 * `identity.role_permission`. Esta app no decide qué puede hacer el usuario
 * leyendo claims del token.
 */
let app: FirebaseApp | undefined
let auth: Auth | undefined

/**
 * Se construye dentro de la guarda y no como objeto suelto: con
 * `exactOptionalPropertyTypes` (tsconfig.base), un `apiKey: string | undefined`
 * no es asignable a `FirebaseOptions`.
 */
function readConfig(): FirebaseOptions | undefined {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
  if (!apiKey) return undefined
  return {
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  }
}

/** `undefined` cuando no hay configuración — permite levantar el dev server sin proyecto. */
export function getFirebaseAuth(): Auth | undefined {
  const config = readConfig()
  if (!config) return undefined
  app ??= initializeApp(config)
  auth ??= getAuth(app)
  return auth
}

export async function getIdToken(): Promise<string | undefined> {
  return getFirebaseAuth()?.currentUser?.getIdToken()
}

/**
 * Login con correo y contraseña → idToken listo para canjear en
 * `POST /auth/session`. Sin proyecto configurado (dev con mocks) devuelve un
 * token ficticio: la capa de mocks acepta cualquiera.
 */
export async function signInWithEmail(email: string, password: string): Promise<string> {
  const auth = getFirebaseAuth()
  if (!auth) return 'mock-id-token'

  const credentials = await signInWithEmailAndPassword(auth, email, password)
  return credentials.user.getIdToken()
}

/**
 * Recuperación de contraseña **por el API**, no por el SDK.
 *
 * La contraseña sigue viviendo en Firebase (D-05) y el enlace lo sigue
 * emitiendo él; lo que cambia es quién manda el correo. Mientras esto lo
 * hacía `sendPasswordResetEmail` desde el navegador, era el único correo del
 * sistema que salía con la plantilla de Firebase, que no se puede tocar.
 *
 * El API responde 204 exista o no la cuenta, así que aquí tampoco hay nada
 * que distinguir: la pantalla dice lo mismo siempre.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const base = import.meta.env.VITE_API_URL ?? '/api/v1'

  try {
    await fetch(`${base}/auth/password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
  } catch {
    /* Ni el error de red se cuenta: la pantalla ya dice lo mismo exista o no
       la cuenta, y distinguir «no hay internet» de «no existe» aquí solo
       serviría para adivinar quién tiene cuenta. Quien no reciba el correo
       vuelve a pedirlo. */
  }
}
