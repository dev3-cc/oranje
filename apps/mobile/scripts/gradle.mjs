/**
 * Corre Gradle del proyecto Android sin pedirle al desarrollador que configure
 * nada a mano.
 *
 * En Windows el `java` del PATH suele ser un JRE viejo (aquí era el 8) y el
 * plugin de Android exige 17+. Android Studio trae su propio JDK —el JBR— así
 * que se usa ese si `JAVA_HOME` no apunta ya a uno servible. Lo mismo con el
 * SDK: `ANDROID_HOME` rara vez está puesto, y el SDK vive donde Studio lo deja.
 *
 * Uso:  node scripts/gradle.mjs assembleDebug
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

const isWindows = platform() === 'win32'
const androidDir = fileURLToPath(new URL('../android', import.meta.url))

if (!existsSync(androidDir)) {
  console.error('No existe android/. Corre antes:  pnpm -F @oranje/mobile sync')
  process.exit(1)
}

/** Candidatos de JDK 17+, en orden de preferencia. */
function findJdk() {
  if (process.env.JAVA_HOME && existsSync(join(process.env.JAVA_HOME, 'bin'))) {
    return process.env.JAVA_HOME
  }
  const candidates = isWindows
    ? [
        'C:\\Program Files\\Android\\Android Studio\\jbr',
        'C:\\Program Files\\Android\\Android Studio Preview\\jbr',
        join(homedir(), 'AppData\\Local\\Programs\\Android Studio\\jbr'),
      ]
    : [
        '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
        '/usr/lib/jvm/java-21-openjdk',
        '/usr/lib/jvm/java-17-openjdk',
      ]
  return candidates.find((dir) => existsSync(join(dir, 'bin')))
}

/** Dónde dejó Android Studio el SDK. */
function findSdk() {
  if (process.env.ANDROID_HOME && existsSync(process.env.ANDROID_HOME)) return process.env.ANDROID_HOME
  if (process.env.ANDROID_SDK_ROOT && existsSync(process.env.ANDROID_SDK_ROOT)) {
    return process.env.ANDROID_SDK_ROOT
  }
  const candidates = isWindows
    ? [join(homedir(), 'AppData\\Local\\Android\\Sdk')]
    : [join(homedir(), 'Library/Android/sdk'), join(homedir(), 'Android/Sdk')]
  return candidates.find((dir) => existsSync(dir))
}

const javaHome = findJdk()
const androidHome = findSdk()

if (!javaHome) {
  console.error('No se encontró un JDK 17+. Instala Android Studio o pon JAVA_HOME.')
  process.exit(1)
}
if (!androidHome) {
  console.error('No se encontró el SDK de Android. Instálalo desde Android Studio o pon ANDROID_HOME.')
  process.exit(1)
}

console.log(`JDK: ${javaHome}`)
console.log(`SDK: ${androidHome}`)

const task = process.argv.slice(2)
if (task.length === 0) task.push('assembleDebug')

/* Ruta ABSOLUTA al wrapper: con `shell: true` en Windows, `cmd` no busca en el
   `cwd` del proceso hijo y «gradlew.bat no se reconoce» aunque esté ahí. */
const wrapper = join(androidDir, isWindows ? 'gradlew.bat' : 'gradlew')

const result = spawnSync(wrapper, task, {
  cwd: androidDir,
  stdio: 'inherit',
  shell: isWindows,
  env: { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome },
})

process.exit(result.status ?? 1)
