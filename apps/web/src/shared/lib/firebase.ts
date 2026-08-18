import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import {
  getAuth,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  type Auth,
} from 'firebase/auth'

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
 * Recuperación de contraseña: Firebase manda el correo con el enlace, la API
 * ni se entera (la contraseña vive en Firebase, D-05). Sin proyecto
 * configurado no hace nada: el mock no tiene a dónde escribir.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const auth = getFirebaseAuth()
  if (!auth) return
  await sendPasswordResetEmail(auth, email)
}
