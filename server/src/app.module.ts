import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { DocumentsModule } from './documents/documents.module'

@Module({
  imports: [DocumentsModule],
  controllers: [AppController],
})
export class AppModule {}
