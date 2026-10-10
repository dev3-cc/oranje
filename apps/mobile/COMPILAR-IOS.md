# Compilar y depurar la app del Colaborador en iOS

Guía para compilar `@oranje/mobile` en un iPhone o en el simulador. Complementa el
[README](README.md), que explica qué es la app y por qué está hecha con Capacitor.

> **Estado al 2026-09-29:** compila con Xcode 27 y corre en un iPhone con iOS 27.
> Lo que hizo falta en la primera compilación (mínimo iOS 15.0, `SceneDelegate`,
> Firebase Auth, CORS de `capacitor://`) está en [CLAUDE.md](CLAUDE.md). Falta
> recorrer la lista de [Qué probar la primera vez](#5-qué-probar-la-primera-vez).

## 1. Requisitos

| Qué       | Versión                | Por qué                                                                                                                                                          |
| --------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS     | **14.5 o superior**    | Xcode 16 no se instala en versiones anteriores.                                                                                                                  |
| Xcode     | **16 o superior**      | Lo exige Capacitor 7. Hay que abrirlo una vez para que instale sus componentes.                                                                                  |
| CocoaPods | 1.15 o superior        | Instala Capacitor dentro del proyecto de Xcode.                                                                                                                  |
| Node      | 22 o superior          | `engines` del `package.json` raíz.                                                                                                                               |
| pnpm      | la de `packageManager` | Se usa por **corepack**: `corepack pnpm …`                                                                                                                       |
| Apple ID  | cualquiera             | Para firmar e instalar en un iPhone propio. Con una cuenta gratuita la app caduca a los 7 días; para TestFlight hace falta la cuenta de Apple Developer de pago. |

Instalación de lo que falte:

```bash
xcode-select --install                    # herramientas de línea de comandos
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
brew install cocoapods                    # o: sudo gem install cocoapods
corepack enable                           # deja `pnpm` disponible
```

Comprobación:

```bash
xcodebuild -version      # Xcode 16.x
pod --version
node -v                  # v22 o superior
```

## 2. Compilar

Desde la raíz del monorepo:

```bash
# 1. Dependencias (solo la web y la app; no hace falta bajar el API)
corepack pnpm install --frozen-lockfile --filter "@oranje/web..." --filter "@oranje/mobile..."

# 2. El bundle del Colaborador → apps/web/dist-mobile
corepack pnpm -F @oranje/web build:mobile

# 3. Copiarlo a iOS y actualizar el Podfile
cd apps/mobile
corepack pnpm exec cap sync ios

# 4. Instalar los pods
cd ios/App
pod install

# 5. Abrir el WORKSPACE (no el .xcodeproj)
open App.xcworkspace
```

Sobre el paso 3: el `Podfile` apunta a Capacitor por una ruta interna de pnpm
(`node_modules/.pnpm/@capacitor+ios@7.x…`). `cap sync ios` la reescribe con la versión
instalada. Si `pod install` dice que no encuentra `Capacitor`, casi siempre es porque
se saltó este paso.

## 3. Firmar e instalar en un iPhone

1. En Xcode, selecciona el proyecto **App** → target **App** → pestaña
   **Signing & Capabilities**.
2. Marca **Automatically manage signing** y elige tu **Team** (tu Apple ID; agrégalo
   en _Xcode › Settings › Accounts_ si no aparece).
3. El **Bundle Identifier** es `com.oranjepeople.colaborador`. Con una cuenta gratuita
   ese identificador puede estar tomado: cámbialo solo en tu copia local (p. ej.
   `com.oranjepeople.colaborador.hugo`) y **no lo subas al repo**.
4. Conecta el iPhone por cable, desbloquéalo y acepta «Confiar en este ordenador».
5. En el iPhone, activa **Modo de desarrollador** (Ajustes › Privacidad y seguridad ›
   Modo de desarrollador). Pide reiniciar el teléfono.
6. En Xcode, elige el iPhone arriba (junto a «App») y pulsa **Run** (⌘R).
7. La primera vez iOS bloquea la app: en el iPhone ve a Ajustes › General › VPN y
   gestión de dispositivos, y confía en tu perfil de desarrollador.

En el **simulador** basta con elegir un iPhone de la lista y pulsar Run; no hace falta
firmar. La cámara no funciona en el simulador, así que el ponche con selfie o con QR
solo se prueba en un teléfono real.

## 4. Depurar

La app es un WKWebView, y se depura con **Safari** de la Mac:

1. En el iPhone: Ajustes › Apps › Safari › Avanzado › **Inspector web**, activado.
2. En la Mac: Safari › Ajustes › Avanzado › **Mostrar funciones para desarrolladores
   web**.
3. Con la app abierta: Safari › menú **Desarrollo** › tu iPhone › `mi.oranjepeople.com`.

Ahí están la consola, la red, los breakpoints y los elementos, igual que con
`chrome://inspect` en Android. El inspector está disponible en las compilaciones de
Debug (`isInspectable` lo activa Capacitor).

Los logs **nativos** (la pantalla de Permisos, el plugin) salen en la consola de Xcode,
en la parte de abajo mientras corre la app.

## 5. Qué probar la primera vez

La pantalla de Permisos está probada en Android pero **no en iOS**. Antes de dar por
buena la compilación:

- [ ] Al iniciar sesión se abre la pantalla nativa **Permisos**, con el nombre y en el
      idioma de la cuenta.
- [ ] **Ubicación sin pedir** → «Sin permiso» + **Dar permiso** → sale el diálogo de iOS.
- [ ] **Ubicación negada** → «Bloqueado» + **Abrir configuración** → abre los ajustes
      de la app; al volver, la tarjeta se actualiza sola.
- [ ] **Ubicación exacta apagada** (en los ajustes de la app) → «Solo aproximada».
- [ ] **Localización apagada** en Ajustes › Privacidad y seguridad → la tarjeta del GPS
      dice «Apagado» y explica dónde encenderlo. iOS no deja abrir ese interruptor
      desde una app: es lo esperado.
- [ ] **Cámara**: los mismos tres estados que la ubicación.
- [ ] Con algo faltante, **Ponchar** está deshabilitado; con todo en verde, lleva a
      Ponchar.
- [ ] **Ir a Inicio** lleva a Inicio.
- [ ] En el menú del avatar aparece **Permisos** y vuelve a abrir la pantalla.
- [ ] Con un permiso quitado, la pestaña **Ponchar** muestra «Faltan permisos para
      ponchar» en vez del botón de marca.
- [ ] La tipografía es **Montserrat**. Si sale la del sistema, no se copió la carpeta
      `Fonts` al bundle (ver abajo).
- [ ] La selfie y el lector de QR abren la cámara **sin un segundo aviso de permiso**
      del WebView (Capacitor lo concede solo).
- [ ] Quince minutos después de entrar, la sesión sigue viva (ver «Pendiente antes de
      publicar» en el [README](README.md): el refresh puede fallar en WKWebView).

## Si falla la compilación

| Síntoma                                                              | Dónde mirar                                                                                                                                                                                              |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pod install`: _No podspec found for Capacitor_                      | Falta `cap sync ios` (paso 3 de §2).                                                                                                                                                                     |
| Error de Swift en `OranjePermissions.swift`                          | Es el único archivo Swift de la pantalla de Permisos; compiló sin errores con Xcode 27. Corrige y anota el cambio.                                                                                       |
| _Unknown class OranjeBridgeViewController in Interface Builder file_ | `Base.lproj/Main.storyboard` debe tener `customClass="OranjeBridgeViewController"` y `customModule="App"`, y `OranjePermissions.swift` debe estar en el target **App** (Build Phases › Compile Sources). |
| La pantalla de Permisos nunca aparece                                | `OranjeBridgeViewController.capacitorDidLoad()` registra el plugin. Desde Safari, `Capacitor.isPluginAvailable('OranjePermissions')` debe dar `true`.                                                    |
| Todo sale con la fuente del sistema                                  | La carpeta `App/Fonts` debe estar en Build Phases › Copy Bundle Resources, como **referencia de carpeta** (azul), no como grupo (amarillo).                                                              |
| Pantalla en blanco al abrir                                          | No se corrió `build:mobile` o `cap sync ios` después de cambiar la web: `App/App/public` está vacío o viejo.                                                                                             |
| _Signing requires a development team_                                | Falta el paso 2 de §3.                                                                                                                                                                                   |

## Qué archivos son de iOS

| Archivo                                           | Qué es                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `ios/App/App/OranjePermissions.swift`             | Plugin `OranjePermissions`, pantalla de Permisos, estados y textos. Espejo de los `.java` de Android: si uno cambia, cambia el otro. |
| `ios/App/App/Base.lproj/Main.storyboard`          | Arranca `OranjeBridgeViewController` (el de Capacitor + el plugin).                                                                  |
| `ios/App/App/Fonts/`                              | Montserrat 400/500/600/700; se registra en tiempo de ejecución.                                                                      |
| `ios/App/App/Assets.xcassets/OranjeLogo.imageset` | El logo del encabezado.                                                                                                              |
| `ios/App/App/Info.plist`                          | Textos de los permisos de cámara y ubicación que muestra iOS.                                                                        |

No se suben al repo (están en `ios/.gitignore`): `App/Pods`, `App/App/public`,
`App/App/capacitor.config.json`, `DerivedData` y `xcuserdata`. Se regeneran con los
pasos de §2.

## Publicar (TestFlight / App Store)

Hace falta la cuenta de Apple Developer de pago. En Xcode: destino **Any iOS Device
(arm64)** → Product › **Archive** → **Distribute App** → App Store Connect. Antes,
revisa «Lo demás que falta para tienda» en el [README](README.md): iconos, splash,
deep links de los QR y push.
