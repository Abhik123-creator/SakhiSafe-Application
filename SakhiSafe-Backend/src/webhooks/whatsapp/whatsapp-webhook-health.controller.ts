import { Controller, Get } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';

@ApiTags('Webhooks')
@ApiSecurity('meta-signature')
@Controller('webhooks/health')
export class WhatsAppWebhookHealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      provider: 'whatsapp',
      timestamp: new Date().toISOString(),
    };
  }
}
