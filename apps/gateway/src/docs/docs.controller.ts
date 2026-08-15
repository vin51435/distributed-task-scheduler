import { Controller, Get, Param } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { DocsService } from './docs.service';

@ApiExcludeController()
@Controller('docs/spec')
export class DocsController {
  constructor(private readonly docsService: DocsService) {}

  @Get('unified')
  async getUnifiedSpec() {
    return this.docsService.getUnifiedSpec();
  }

  @Get(':service')
  async getServiceSpec(@Param('service') service: string) {
    return this.docsService.getServiceSpec(service);
  }
}
