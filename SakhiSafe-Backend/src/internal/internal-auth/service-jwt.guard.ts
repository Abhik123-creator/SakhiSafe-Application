import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class ServiceJwtGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;
    const token = typeof authorization === 'string' && authorization.startsWith('Bearer ') ? authorization.slice(7) : null;

    if (!token) {
      throw new UnauthorizedException('Missing service token');
    }

    const payload = await this.jwtService.verifyAsync(token, {
      secret: this.configService.get<string>('SERVICE_JWT_SECRET') ?? 'very-strong-service-jwt-secret',
    });

    if (payload?.type !== 'service') {
      throw new UnauthorizedException('Invalid service token');
    }

    request.service = payload;
    return true;
  }
}
