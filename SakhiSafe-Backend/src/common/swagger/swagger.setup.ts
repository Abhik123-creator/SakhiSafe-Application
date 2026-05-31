import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { ApiModule } from '../../api/api.module';
import { InternalModule } from '../../internal/internal.module';
import { WebhooksModule } from '../../webhooks/webhooks.module';

function normalizeDocumentPaths(document: OpenAPIObject, prefix: string) {
  document.paths = Object.fromEntries(
    Object.entries(document.paths).map(([path, definition]) => {
      if (path.startsWith(prefix)) {
        return [path, definition];
      }
      return [`${prefix}${path}`, definition];
    }),
  );
  return document;
}

function filterDocumentPaths(document: OpenAPIObject, prefix: string) {
  normalizeDocumentPaths(document, prefix);
  document.paths = Object.fromEntries(Object.entries(document.paths).filter(([path]) => path.startsWith(`${prefix}/`)));
  return document;
}

export function createApiSwaggerDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('SakhiSafe Dashboard API')
    .setDescription('APIs used by the Next.js dashboard and organization/admin users.')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'user-jwt')
    .build();

  return filterDocumentPaths(SwaggerModule.createDocument(app, config, { include: [ApiModule], deepScanRoutes: true }), '/api/v1');
}

export function createInternalSwaggerDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('SakhiSafe Internal Service API')
    .setDescription('Internal APIs used by Python AI service and backend service accounts.')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'service-jwt')
    .build();

  return filterDocumentPaths(
    SwaggerModule.createDocument(app, config, { include: [InternalModule], deepScanRoutes: true }),
    '/internal/v1',
  );
}

export function createWebhookSwaggerDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('SakhiSafe Webhook API')
    .setDescription('Webhook endpoints for WhatsApp/Meta callbacks.')
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-hub-signature-256' }, 'meta-signature')
    .build();

  return filterDocumentPaths(SwaggerModule.createDocument(app, config, { include: [WebhooksModule], deepScanRoutes: true }), '/webhooks');
}

export function setupSwagger(app: INestApplication) {
  SwaggerModule.setup('api-docs', app, createApiSwaggerDocument(app), {
    jsonDocumentUrl: '/api-docs-json',
  });
  SwaggerModule.setup('internal-docs', app, createInternalSwaggerDocument(app), {
    jsonDocumentUrl: '/internal-docs-json',
  });
  SwaggerModule.setup('webhook-docs', app, createWebhookSwaggerDocument(app), {
    jsonDocumentUrl: '/webhook-docs-json',
  });
}
