import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { DocumentsService } from './documents.service'

@Controller('documents')
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @Get(':category')
  list(@Param('category') category: string) {
    return this.docs.list(category)
  }

  @Post(':category')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  // `any` instead of Express.Multer.File: the multer typings package isn't
  // installed, and the service validates shape and content anyway.
  upload(@Param('category') category: string, @UploadedFile() file: any) {
    return this.docs.save(category, file)
  }

  @Get(':category/:file')
  async get(
    @Param('category') category: string,
    @Param('file') file: string,
    @Res({ passthrough: true }) res: Response
  ) {
    const { full, size } = await this.docs.resolve(category, file)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(size),
      // inline: the browser (or PDF.js later) renders it; the viewer offers
      // its own download button.
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file)}`,
      'Cache-Control': 'private, max-age=60',
    })
    return new StreamableFile(this.docs.stream(full))
  }
}
