import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'

import { AllowWhenOverdue, CurrentUser } from '../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../common/decorators/index.js'

import { UploadFileDto } from './dto/upload.dto.js'
import { FilesService } from './files.service.js'
import type { UploadedFile as StoredFile } from './files.service.js'

// Lo que entra sin comprimir. La foto de un teléfono ronda los 5 MB.
const MAX_BYTES = 15 * 1024 * 1024

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  // Abierto aun con el acceso suspendido: subir los bytes del SSN/ITIN es el
  // primer paso de la única salida que tiene la persona (D-33). El permiso por
  // destino sigue decidiendo qué puede subir cada rol.
  @AllowWhenOverdue()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadFileDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: StoredFile }> {
    return { data: await this.files.upload(file, dto.purpose, user) }
  }
}
