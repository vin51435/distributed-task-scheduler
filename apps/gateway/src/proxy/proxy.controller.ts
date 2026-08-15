import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';

@ApiTags('gateway-proxy')
@Controller()
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @All('api/*')
  async handleProxy(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res);
  }
}
