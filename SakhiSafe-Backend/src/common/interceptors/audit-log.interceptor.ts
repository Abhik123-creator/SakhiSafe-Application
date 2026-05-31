import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditAction } from '@prisma/client';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../audit/services/audit.service';
import { maskIpAddress, maskSensitiveData } from '../utils/mask-sensitive-data.util';

export const AUDIT_ACTION_KEY = 'auditAction';
export const AuditActionMeta = (action: AuditAction) => Reflect.metadata(AUDIT_ACTION_KEY, action);

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.getAllAndOverride<AuditAction>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!action) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    return next.handle().pipe(
      tap(async (result: any) => {
        await this.auditService.create({
          actorUserId: request.user?.id,
          action,
          entityType: context.getClass().name.replace('Controller', ''),
          entityId: result?.id,
          ipAddress: maskIpAddress(request.ip),
          userAgent: request.headers['user-agent'],
          metadata: maskSensitiveData({ params: request.params, query: request.query }),
        });
      }),
    );
  }
}
