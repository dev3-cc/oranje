# App del Colaborador en iOS: estado al 2026-09-29

Traspaso de la primera compilación en iOS (rama `rama-geo-23-09-2026`). Si solo
quieres saber cómo compilar, lee [COMPILAR-IOS.md](COMPILAR-IOS.md). Este archivo
dice qué hizo falta, por qué y qué falta.

## Resumen

Probado en un iPhone 16 Pro Max con iOS 27, compilado con Xcode 27:

| Qué                                     | Estado                                |
| --------------------------------------- | ------------------------------------- |
| Compila y abre                          | ✅                                    |
| Login                                   | ✅                                    |
| Ponche                                  | ✅ (se registraron ponches en el API) |
| Subir el SSN/ITIN con la cámara         | ✅ llegó a `workers/document/`        |
| Cambiar la foto de perfil con la cámara | ✅ llegó a `workers/photo/`           |
| Área segura (notch, barra de inicio)    | aplicada, falta confirmarla a ojo     |
| Ubicación con Localización apagada      | corregida, falta probarla             |
| Checklist «Qué probar» de COMPILAR-IOS  | sin recorrer completo                 |

## Lo que hizo falta y por qué

### 1. Mínimo de iOS: 14.0 → 15.0

Xcode 27 solo acepta de 15.0 a 27.0. Se cambió en tres sitios:
`App.xcodeproj/project.pbxproj`, `platform :ios` del `Podfile`, y un `post_install`
del `Podfile` que fuerza 15.0 en los pods. Los podspecs de Capacitor 7 piden 14.0
por su cuenta, y sin ese `post_install` los pods no compilan. `cap sync` no toca
el `post_install`.

### 2. iOS 27 exige escenas: `SceneDelegate`

**Síntoma:** la app se cerraba al abrir (`SIGTRAP` en
`_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`). La plantilla de
Capacitor 7 solo trae `AppDelegate`.

**Arreglo:** `ios/App/App/SceneDelegate.swift` y `UIApplicationSceneManifest` en
`Info.plist`. La escena carga `Main.storyboard`, y con él
`OranjeBridgeViewController`. El `SceneDelegate` pasa las URL y actividades a
`ApplicationDelegateProxy`.

Ojo con el `project.pbxproj`: los IDs de `SceneDelegate` son `7A1C0E5B2F9D4C1A00000005`
y `…06`, porque `…03` y `…04` ya los usa `Fonts`. Si se repite un ID, Xcode no da
ningún error: el archivo simplemente no se compila.

### 3. El origen en iOS es `capacitor://`, no `https://`

WKWebView no deja registrar `https` como esquema propio. Capacitor descarta en
silencio `iosScheme: 'https'` y usa `capacitor://` (ver `CAPInstanceDescriptor.swift`,
`normalize()`). El origen real en iOS es `capacitor://mi.oranjepeople.com`.

- **CORS:** ese origen se añadió a `CORS_ORIGINS`, la variable de GitHub Actions del
  API, el 2026-09-29. Sin él, el login se queda cargando.
- **`iosScheme` se quitó de `capacitor.config.ts`:** no hacía nada.
- **Pendiente:** la cookie del refresh (`Secure`, de tercero en `run.app`) casi
  seguro no se guarda en WKWebView con este origen. Ver «Pendiente antes de
  publicar» en el [README](README.md).

Para comprobar el CORS:

```bash
curl -s -D - -o /dev/null -X OPTIONS \
  https://oranje-api-407623682109.us-central1.run.app/api/v1/auth/login \
  -H "Origin: capacitor://mi.oranjepeople.com" -H "Access-Control-Request-Method: POST" \
  | grep -i access-control-allow-origin
```

### 4. Firebase Auth se colgaba en el login

Con CORS ya arreglado, el login seguía cargando y `/auth/session` nunca llegaba al
API. `getAuth()` carga el resolvedor de popup/redirect, que monta un iframe de
`authDomain` y nunca termina de cargar bajo `capacitor://`. Entonces
`signInWithEmailAndPassword` se queda esperando para siempre.

**Arreglo:** en `apps/web/src/shared/lib/firebase.ts`, dentro de la app se usa
`initializeAuth` con persistencia y sin resolvedor. El navegador sigue con
`getAuth`. La app no usa popups ni redirects.

### 5. Ubicación con Localización apagada

Con Localización (el interruptor general) apagada, iOS responde `denied` para
todas las apps, aunque nunca hayan pedido nada. La pantalla de Permisos decía
«Bloqueado» y mandaba a los ajustes de la app. Pero iOS no enlista «Ubicación»
ahí hasta que la app la pide una vez, así que no había nada que activar.

**Arreglo** en `OranjePermissions.swift`:

- Si nunca se ha pedido (se guarda en `UserDefaults`), la tarjeta dice «Sin
  permiso» con **Dar permiso**.
- Si sale «Bloqueado» con Localización apagada, el texto explica cómo encenderla.

Android no cambia.

### 6. Área segura

`ios.contentInset: 'always'` en `capacitor.config.ts`: iOS deja libres el notch
y la barra de inicio. Es el equivalente de `adjustMarginsForEdgeToEdge` en Android.
No se usa `viewport-fit=cover` porque el HTML de la app es idéntico al de la web
(ver `apps/web/index.mobile.html`).

## Avisos push en iOS (2026-10-12, sin probar todavía)

En Android ya funcionan (probado en el emulador contra `oranje-prod`). En iOS el
código está listo, pero **no se ha compilado**: hace falta Xcode 16+ y un iPhone
real (el simulador no recibe push de forma fiable).

Qué hay en el proyecto:

- `@capacitor-firebase/messaging` en `package.json`; la lógica vive en
  `apps/web/src/mobile/nativePush.ts` (registra el token FCM en `POST /devices`).
- `App/GoogleService-Info.plist` (Firebase `oranje-prod`) en Resources.
- `App/App.entitlements` con `aps-environment = development` (`CODE_SIGN_ENTITLEMENTS`
  en Debug y Release). Al archivar, Xcode lo pasa a `production`.
- `UIBackgroundModes = remote-notification` en `Info.plist`.
- `AppDelegate.swift` reenvía al plugin el token de APNs y los avisos remotos.
- La llave APNs (`.p8`) está subida a Firebase › Cloud Messaging. **Nunca va al
  repo** (`*.p8` está en `.gitignore`).

Para probar en la Mac:

1. `corepack pnpm install`, `corepack pnpm -F @oranje/web build:mobile` y
   `cap sync ios` (instala los pods de Firebase).
2. En Xcode, _Signing & Capabilities_: deben aparecer **Push Notifications** y
   **Background Modes › Remote notifications**. El App ID necesita la capacidad
   Push Notifications en developer.apple.com.
3. Correr en el iPhone, entrar, dar permiso de notificaciones en la pantalla de
   Permisos y mandar la app a segundo plano.
4. Firebase › Messaging › Nueva campaña › **Enviar mensaje de prueba** al token.
   El token se ve en el inspector de Safari:
   `Capacitor.nativePromise('FirebaseMessaging','getToken')`.
   Con _Custom data_ `entityType = operations.timesheet`, al tocarlo un usuario de
   hotel debe abrir `/timesheet`.

## Compilar sin abrir Xcode

Desde la raíz del monorepo, con el iPhone conectado y en Modo de desarrollador:

```bash
corepack pnpm -F @oranje/web build:mobile
cd apps/mobile && corepack pnpm exec cap sync ios && cd ios/App

xcrun devicectl list devices            # copia el UDID de tu iPhone

xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug \
  -destination 'id=<UDID>' -derivedDataPath /tmp/oranje-ios \
  -allowProvisioningUpdates DEVELOPMENT_TEAM=<TU_TEAM_ID> CODE_SIGN_STYLE=Automatic build

xcrun devicectl device install app --device <UDID> /tmp/oranje-ios/Build/Products/Debug-iphoneos/App.app
xcrun devicectl device process launch --device <UDID> com.oranjepeople.colaborador
```

El Team ID es el `OU=` del certificado:
`security find-certificate -c "Apple Development" -p | openssl x509 -noout -subject`.

## Depurar sin el inspector de Safari

- **Si la app se cierra**, saca el informe de fallo del teléfono:

  ```bash
  xcrun devicectl device info files --device <UDID> --domain-type systemCrashLogs | grep App-
  xcrun devicectl device copy from --device <UDID> --domain-type systemCrashLogs \
    --source App-<fecha>.ips --destination crash.ips
  ```

- **Qué pidió la app al API:** el WebView de la app manda un User-Agent con
  `Mobile/15E148` y sin `Safari`. Así se filtra en Cloud Run:

  ```bash
  gcloud logging read 'resource.type="cloud_run_revision" AND httpRequest.userAgent:"Mobile/15E148"
    AND NOT httpRequest.userAgent:"Safari" AND NOT httpRequest.requestMethod="OPTIONS"' \
    --project oranje-prod --limit 30 \
    --format='value(timestamp,httpRequest.requestMethod,httpRequest.status,httpRequest.requestUrl)'
  ```

- **Qué se subió:** `gcloud storage ls -l "gs://oranje-prod-files/workers/photo/**"`, y
  lo mismo con `workers/document`.

## Siguientes pasos

1. Confirmar a ojo el área segura y la ubicación con Localización apagada.
2. Recorrer el checklist «Qué probar la primera vez» de COMPILAR-IOS.md.
3. Resolver el refresh de sesión en iOS (cookie de tercero con `capacitor://`).
4. El login no muestra ningún error si falla una petición: se queda cargando.
   Convendría mostrar un error.
