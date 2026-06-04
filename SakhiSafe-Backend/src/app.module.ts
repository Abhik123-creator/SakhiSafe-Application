import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { NestLensModule } from 'nestlens';
import appConfig from './config/app.config';
import authConfig from './config/auth.config';
import databaseConfig from './config/database.config';
import { ApiModule } from './api/api.module';
import { AuditCoreModule } from './audit/audit-core.module';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { maskSensitiveData } from './common/utils/mask-sensitive-data.util';
import { InternalModule } from './internal/internal.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, authConfig],
    }),
    MailModule,
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req) => {
          const request = req as any;
          return request.headers['x-request-id']?.toString() ?? request.requestId;
        },
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: { singleLine: true },
              },
        customProps: (req) => ({
          requestId: (req as any).requestId,
          userId: (req as any).user?.id,
          role: (req as any).user?.roles?.[0],
        }),
        serializers: {
          req(req) {
            return maskSensitiveData({
              method: req.method,
              url: req.url,
              headers: req.headers,
            });
          },
          res(res) {
            return { statusCode: res.statusCode };
          },
        },
        customSuccessMessage: (req, res) =>
          `${req.method} ${req.url} ${res.statusCode} ${Date.now() - (req as any).startTime}ms`,
      },
    }),
    NestLensModule.forRoot({
      enabled: process.env.NODE_ENV !== 'production',
      path: '/nestlens',
      security: {
        dataMasking: {
          sensitiveHeaders: ['authorization', 'x-evidence-access-code'],
          sensitiveParams: [
            'password',
            'token',
            'accessCode',
            'evidenceAccessCode',
            'evidenceAccessCodeHash',
            'oneTimeEvidenceAccessCode',
            'phone',
            'name',
            'address',
            'notes',
            'message',
            'incidentDescription',
            'evidence',
            'safetyNotes',
          ],
          maskReplacement: '[REDACTED]',
        },
        stackTraceSanitization: 'partial',
      },
      watchers: {
        request: { enabled: true, captureHeaders: true, captureBody: true },
        mail: { enabled: true },
        model: { enabled: true, captureData: false },
        redis: { enabled: false },
        job: { enabled: false },
      },
    }),
    PrismaModule,
    AuditCoreModule,
    ApiModule,
    InternalModule,
    WebhooksModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
