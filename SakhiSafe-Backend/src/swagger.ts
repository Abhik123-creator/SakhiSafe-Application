import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

function hideInternalDebugRoutes(document: ReturnType<typeof SwaggerModule.createDocument>) {
  document.paths = Object.fromEntries(
    Object.entries(document.paths).filter(([path]) => !path.includes('/nestlens') && !path.includes('/__nestlens__')),
  );

  return document;
}

export function createSwaggerDocument(app: INestApplication) {
  const documentConfig = new DocumentBuilder()
    .setTitle('SakhiSafe API')
    .setDescription('SakhiSafe backend API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  return hideInternalDebugRoutes(SwaggerModule.createDocument(app, documentConfig));
}
