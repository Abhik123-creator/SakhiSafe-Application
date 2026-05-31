import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ApiModule } from '../src/api/api.module';
import appConfig from '../src/config/app.config';
import authConfig from '../src/config/auth.config';
import databaseConfig from '../src/config/database.config';
import { createApiSwaggerDocument, createInternalSwaggerDocument, createWebhookSwaggerDocument } from '../src/common/swagger/swagger.setup';
import { InternalModule } from '../src/internal/internal.module';
import { WebhooksModule } from '../src/webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, authConfig],
    }),
    ApiModule,
    InternalModule,
    WebhooksModule,
  ],
})
class SwaggerGenerationModule {}

async function generateSwagger() {
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'production';
  process.env.ENABLE_SWAGGER = 'true';

  const app = await NestFactory.create(SwaggerGenerationModule, { logger: false });

  const documents = [
    { filename: 'swagger.json', document: createApiSwaggerDocument(app) },
    { filename: 'api-docs.json', document: createApiSwaggerDocument(app) },
    { filename: 'internal-docs.json', document: createInternalSwaggerDocument(app) },
    { filename: 'webhook-docs.json', document: createWebhookSwaggerDocument(app) },
  ];

  for (const { filename, document } of documents) {
    writeFileSync(resolve(process.cwd(), filename), `${JSON.stringify(document, null, 2)}\n`);
  }

  await app.close();
  process.stdout.write(`Swagger JSON generated at ${documents.map((item) => item.filename).join(', ')}\n`);
}

generateSwagger().catch((error) => {
  process.stderr.write(`Swagger generation failed: ${error instanceof Error ? error.stack : JSON.stringify(error)}\n`);
  process.exit(1);
});
