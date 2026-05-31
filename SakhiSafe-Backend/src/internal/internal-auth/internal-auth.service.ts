import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ServiceTokenRequestDto } from './dto/service-token-request.dto';
import { ServiceTokenResponseDto } from './dto/service-token-response.dto';

const SERVICE_PERMISSIONS = [
  'conversations.read',
  'messages.read',
  'messages.create',
  'cases.create',
  'cases.update',
  'cases.update-risk',
  'incidents.create',
  'resources.read',
  'ai-summaries.create',
];

@Injectable()
export class InternalAuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async createToken(request: ServiceTokenRequestDto): Promise<ServiceTokenResponseDto> {
    const expectedClientId = this.configService.getOrThrow<string>('INTERNAL_SERVICE_CLIENT_ID');
    const expectedClientSecret = this.configService.getOrThrow<string>('INTERNAL_SERVICE_CLIENT_SECRET');
    const serviceJwtSecret = this.configService.getOrThrow<string>('SERVICE_JWT_SECRET');
    const expiresIn = this.configService.getOrThrow<string>('SERVICE_JWT_EXPIRES_IN');

    if (request.clientId !== expectedClientId || request.clientSecret !== expectedClientSecret) {
      throw new UnauthorizedException('Invalid service credentials');
    }

    const payload = {
      sub: expectedClientId,
      type: 'service',
      serviceName: expectedClientId,
      clientId: expectedClientId,
      permissions: SERVICE_PERMISSIONS,
      jti: randomUUID(),
    };

    return {
      accessToken: await this.jwtService.signAsync(payload, {
        secret: serviceJwtSecret,
        expiresIn,
      }),
      tokenType: 'Bearer',
      expiresIn: this.toSeconds(expiresIn),
    };
  }

  private toSeconds(expiresIn: string) {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      return Number(expiresIn);
    }

    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 60 * 60,
      d: 24 * 60 * 60,
    };

    return value * multipliers[unit];
  }
}
