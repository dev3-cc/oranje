import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'

import type { AuthenticatedUser } from '../../common/decorators/index.js'
import { StorageService, compressImage } from '../../infra/storage/index.js'
import { PermissionsService } from '../identity/index.js'

import type { Purpose } from './dto/upload.dto.js'

interface PurposeConfig {
  folder: string
  module: string
  action: string
  maxSide: number
  quality: number
  allowsPdf: boolean
}

// Cada destino trae su permiso y su tamaño. El del documento fiscal es el mayor
// porque lo lee una persona para verificarlo.
const CONFIG: Record<Purpose, PurposeConfig> = {
  WORKER_PHOTO: {
    folder: 'workers/photo',
    module: 'recruitment',
    action: 'update_worker',
    maxSide: 512,
    quality: 80,
    allowsPdf: false,
  },
  WORKER_DOCUMENT: {
    folder: 'workers/document',
    module: 'recruitment',
    action: 'update_worker',
    maxSide: 2000,
    quality: 85,
    allowsPdf: true,
  },
  PUNCH_PHOTO: {
    folder: 'operations/punch',
    module: 'timesheet',
    action: 'read_department',
    maxSide: 800,
    quality: 75,
    allowsPdf: false,
  },
}

const PDF_MIME = 'application/pdf'

export interface UploadedFile {
  path: string
  /// URL firmada para previsualizar. Lo que se guarda en la entidad es `path`.
  url: string | null
  contentType: string
  bytes: number
  originalBytes: number
}

@Injectable()
export class FilesService {
  constructor(
    private readonly storage: StorageService,
    private readonly permissions: PermissionsService,
  ) {}

  async upload(
    file: Express.Multer.File | undefined,
    purpose: Purpose,
    actor: AuthenticatedUser,
  ): Promise<UploadedFile> {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Falta el archivo en el campo `file`',
      })
    }

    const config = CONFIG[purpose]

    if (!(await this.permissions.can(actor.roleCode, config.module, config.action))) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Esta acción requiere un permiso que tu rol no tiene',
      })
    }

    const isPdf = file.mimetype === PDF_MIME

    if (isPdf && !config.allowsPdf) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_FILE_TYPE',
        message: 'Este destino solo acepta imágenes',
      })
    }

    const processed = isPdf
      ? { buffer: file.buffer, contentType: PDF_MIME, extension: 'pdf' }
      : await this.compress(file.buffer, config)

    const path = await this.storage.upload({
      buffer: processed.buffer,
      contentType: processed.contentType,
      folder: config.folder,
      extension: processed.extension,
    })

    return {
      path,
      url: await this.storage.signedUrl(path),
      contentType: processed.contentType,
      bytes: processed.buffer.length,
      originalBytes: file.size,
    }
  }

  // El `mimetype` lo declara el cliente y puede mentir. Que sharp lo abra es la
  // verificación real de que es una imagen.
  private async compress(
    buffer: Buffer,
    config: PurposeConfig,
  ): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
    try {
      return await compressImage(buffer, { maxSide: config.maxSide, quality: config.quality })
    } catch {
      throw new BadRequestException({
        code: 'UNSUPPORTED_FILE_TYPE',
        message: 'El archivo no es una imagen que se pueda procesar',
      })
    }
  }
}
