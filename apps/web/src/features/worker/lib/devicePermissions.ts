/**
 * Cámara y ubicación, en un solo lugar: pedirlas (dispara el diálogo nativo
 * del navegador) y consultar qué contestó la persona la última vez, sin
 * volver a pedir. `'unsupported'` cubre tanto al navegador que no tiene la
 * API como a Safari, que no expone `permissions.query('camera')` — se trata
 * igual que «no lo sabemos todavía», nunca como negado.
 */
export type DevicePermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported'

/** Abre y cierra la cámara de inmediato: solo interesa el permiso, no el video. */
export async function requestCameraPermission(): Promise<DevicePermissionState> {
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported'
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    })
    stream.getTracks().forEach((track) => {
      track.stop()
    })
    return 'granted'
  } catch (cause) {
    return cause instanceof DOMException && cause.name === 'NotAllowedError'
      ? 'denied'
      : 'unsupported'
  }
}

export function requestLocationPermission(): Promise<DevicePermissionState> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve('unsupported')
      return
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        resolve('granted')
      },
      (error) => {
        resolve(error.code === error.PERMISSION_DENIED ? 'denied' : 'unsupported')
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  })
}

/** Lo que el navegador ya sabe, sin disparar ningún diálogo. */
export async function queryPermissionState(
  name: 'camera' | 'geolocation',
): Promise<DevicePermissionState> {
  try {
    const status = await navigator.permissions.query({ name })
    return status.state
  } catch {
    return 'unsupported'
  }
}
