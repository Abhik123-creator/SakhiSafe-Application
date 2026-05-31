import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    return next.handle().pipe(
      map((response) => ({
        success: true,
        data: response?.data ?? response ?? {},
        meta: response?.meta ?? {},
        requestId: request.requestId,
      })),
    );
  }
}
