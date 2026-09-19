import { Storage } from '@google-cloud/storage'
import type { Bucket } from '@google-cloud/storage'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { GoogleAuth, Impersonated } from 'google-auth-library'
import { v7 as uuidv7 } from 'uuid'

import type { Env } from '../../config/env.validation.js'

const SIGNED_URL_TTL_MS = 60 * 60 * 1000
// Margen para no entregar una URL a punto de caducar.
const CACHE_MARGIN_MS = 5 * 60 * 1000
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform'

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private readonly bucket: Bucket
  private readonly signerAccount: string | undefined
  private readonly quotaProject: string | undefined
  private signerBucket: Promise<Bucket> | null = null
  private readonly urlCache = new Map<string, { url: string; expiresAt: number }>()
  private signingWarned = false

  constructor(config: ConfigService<Env, true>) {
    const name = config.get('STORAGE_BUCKET', { infer: true })

    this.bucket = new Storage().bucket(name)
    this.signerAccount = config.get('STORAGE_SIGNER_SERVICE_ACCOUNT', { infer: true })
    this.quotaProject = config.get('GOOGLE_CLOUD_QUOTA_PROJECT', { infer: true })
  }

  async upload(params: {
    buffer: Buffer
    contentType: string
    folder: string
    extension: string
  }): Promise<string> {
    const path = `${params.folder}/${uuidv7()}.${params.extension}`

    await this.bucket.file(path).save(params.buffer, {
      contentType: params.contentType,
      resumable: false,
      metadata: { cacheControl: 'private, max-age=31536000' },
    })

    return path
  }

  // El bucket es privado: guarda caras, documentos fiscales y fotos de ponche.
  // La URL se firma al leer y caduca, para que el front la ponga en un <img>
  // sin exponer el objeto.
  //
  // Se cachea porque cada firma es una llamada a IAM, y una lista del Pool son
  // decenas de rutas.
  async signedUrl(path: string): Promise<string | null> {
    const cached = this.urlCache.get(path)

    if (cached && cached.expiresAt > Date.now()) {
      return cached.url
    }

    const bucket = await this.resolveSigner()

    try {
      const [url] = await bucket.file(path).getSignedUrl({
        action: 'read',
        version: 'v4',
        expires: Date.now() + SIGNED_URL_TTL_MS,
      })

      this.urlCache.set(path, {
        url,
        expiresAt: Date.now() + SIGNED_URL_TTL_MS - CACHE_MARGIN_MS,
      })

      return url
    } catch (error) {
      this.warnOnce(error)

      return null
    }
  }

  // Sin firma la foto no se ve, pero la ficha si: devolver null en vez de
  // tumbar la respuesta entera. Se avisa una vez por proceso, no por fila.
  private warnOnce(error: unknown): void {
    if (this.signingWarned) {
      return
    }

    this.signingWarned = true
    this.logger.error(
      `No se pudo firmar la URL, las fotos no se veran. Fuera de Cloud Run hace falta STORAGE_SIGNER_SERVICE_ACCOUNT. Causa: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  async remove(path: string): Promise<void> {
    this.urlCache.delete(path)

    await this.bucket.file(path).delete({ ignoreNotFound: true })
  }

  // Firmar en V4 exige una llave o la API de IAM. En Cloud Run la cuenta va
  // adjunta y sale solo; con credenciales de usuario no hay con que firmar, y
  // por eso en local se impersona una cuenta de servicio.
  //
  // Solo para firmar: subir y borrar van con las credenciales de siempre, para
  // que la falta de ese permiso no tumbe tambien las escrituras.
  private async resolveSigner(): Promise<Bucket> {
    if (!this.signerAccount) {
      return this.bucket
    }

    this.signerBucket ??= this.buildSigner(this.signerAccount)

    return this.signerBucket
  }

  private async buildSigner(account: string): Promise<Bucket> {
    const auth = new GoogleAuth({ scopes: SCOPE })
    const sourceClient = await auth.getClient()

    // El proyecto al que se le cobra la llamada. Sale del archivo de
    // credenciales, y si esa maquina trabaja tambien en otro proyecto apunta
    // ahi: la llamada se rechaza por un proyecto que no es el nuestro.
    if (this.quotaProject) {
      sourceClient.quotaProjectId = this.quotaProject
    }

    const authClient = new Impersonated({
      sourceClient,
      targetPrincipal: account,
      targetScopes: [SCOPE],
      lifetime: 3600,
    })

    return new Storage({ authClient }).bucket(this.bucket.name)
  }
}
