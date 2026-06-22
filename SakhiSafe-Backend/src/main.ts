import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import helmet from 'helmet';
import { resolve } from 'path';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { setupSwagger } from './common/swagger/swagger.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  app.useLogger(app.get(Logger));

  app.use(new RequestIdMiddleware().use);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: process.env.ENABLE_SWAGGER === 'true' ? false : undefined,
    })
  );
  app.use(compression());
  app.use(cookieParser());
  app.use('/uploads/branding', express.static(resolve(process.cwd(), 'private', 'uploads', 'branding')));
  app.enableCors({
    origin: config.get<string>('app.frontendUrl'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter(config));
  app.useGlobalInterceptors(new TransformResponseInterceptor(app.get(Reflector)));

  if (process.env.ENABLE_SWAGGER === 'true') {
    setupSwagger(app);
  }

  await app.listen(config.get<number>('app.port') ?? 4000);
}

bootstrap();
