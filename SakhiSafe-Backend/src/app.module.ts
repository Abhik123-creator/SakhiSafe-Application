import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { NestLensModule } from 'nestlens';
import appConfig from './config/app.config';
import authConfig from './config/auth.config';
import databaseConfig from './config/database.config';
import { AuditModule } from './audit/audit.module';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { maskSensitiveData } from './common/utils/mask-sensitive-data.util';
import { AuthModule } from './auth/auth.module';
import { CasesModule } from './cases/cases.module';
import { CareSeekersModule } from './care-seekers/care-seekers.module';
import { HealthModule } from './health/health.module';
import { ModulesModule } from './modules/modules.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PermissionsModule } from './permissions/permissions.module';
import { PrismaModule } from './prisma/prisma.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, authConfig],
    }),
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
          sensitiveHeaders: ['authorization'],
          sensitiveParams: [
            'password',
            'token',
            'phone',
            'name',
            'address',
            'notes',
            'message',
            'incidentDescription',
            'evidence',
            'safetyNotes',
          ],
        },
        stackTraceSanitization: 'partial',
      },
      watchers: {
        request: { enabled: true, captureHeaders: true, captureBody: true },
        model: { enabled: true, captureData: false },
        redis: { enabled: false },
        job: { enabled: false },
      },
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    RolesModule,
    ModulesModule,
    PermissionsModule,
    OrganizationsModule,
    CareSeekersModule,
    CasesModule,
    HealthModule,
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
