import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';

@ApiExcludeController()
@Controller()
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @All('api/*')
  async handleProxy(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res);
  }
}
