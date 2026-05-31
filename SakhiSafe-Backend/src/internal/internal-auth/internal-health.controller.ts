import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Internal Health')
@ApiBearerAuth('service-jwt')
@Controller('internal/v1/health')
export class InternalHealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'internal',
      timestamp: new Date().toISOString(),
    };
  }
}
