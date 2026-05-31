import { Module } from '@nestjs/common';
import { WhatsAppWebhookHealthController } from './whatsapp/whatsapp-webhook-health.controller';

@Module({
  controllers: [WhatsAppWebhookHealthController],
})
export class WebhooksModule {}
