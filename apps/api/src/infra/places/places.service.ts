import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../../config/env.validation.js'

const DETAILS_URL = 'https://places.googleapis.com/v1/places'
const MEDIA_URL = 'https://places.googleapis.com/v1'
const MAX_WIDTH_PX = 640

// La politica de Google: el place_id se puede guardar indefinidamente, el resto
// del contenido de Places no mas de 30 dias. Por eso la referencia se refresca,
// no se guarda para siempre.
const REF_TTL_MS = 30 * 24 * 60 * 60 * 1000

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name)
  private readonly serverKey: string | undefined
  private readonly browserKey: string | undefined

  constructor(config: ConfigService<Env, true>) {
    this.serverKey = config.get('GOOGLE_PLACES_API_KEY', { infer: true })
    this.browserKey = config.get('GOOGLE_MAPS_BROWSER_KEY', { infer: true })
  }

  get enabled(): boolean {
    return this.serverKey !== undefined
  }

  isStale(resolvedAt: Date | null): boolean {
    return resolvedAt === null || Date.now() - resolvedAt.getTime() > REF_TTL_MS
  }

  // Devuelve el resource name de la primera foto, que es lo estable. Null si el
  // lugar no tiene fotos, si no hay llave o si Places falla: un hotel sin foto
  // es correcto, y una foto no puede tumbar el alta.
  async photoRef(placeId: string): Promise<string | null> {
    if (!this.serverKey) {
      return null
    }

    try {
      const response = await fetch(`${DETAILS_URL}/${encodeURIComponent(placeId)}`, {
        headers: {
          'X-Goog-Api-Key': this.serverKey,
          'X-Goog-FieldMask': 'photos',
        },
      })

      if (!response.ok) {
        this.logger.warn(`Places respondió ${response.status} para ${placeId}`)

        return null
      }

      const body = (await response.json()) as { photos?: Array<{ name?: string }> }

      return body.photos?.[0]?.name ?? null
    } catch (error) {
      this.logger.warn(`No se pudo resolver la foto de ${placeId}: ${String(error)}`)

      return null
    }
  }

  // La URL de media, compuesta al leer. Lleva la llave del NAVEGADOR —publica
  // por diseno y restringida por referrer (D-17)—, no la del servidor: esta
  // URL termina en un <img> del front.
  mediaUrl(photoRef: string | null): string | null {
    if (!photoRef || !this.browserKey) {
      return null
    }

    return `${MEDIA_URL}/${photoRef}/media?maxWidthPx=${MAX_WIDTH_PX}&key=${this.browserKey}`
  }
}
