import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditAction } from '@prisma/client';
import { AuditService } from '../../audit/services/audit.service';
import { maskIpAddress } from '../../common/utils/mask-sensitive-data.util';
import { verifyPassword } from '../../common/utils/password.util';
import { UsersService } from '../../users/services/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException();
    }
    return this.usersService.toSafeUser(user);
  }

  async login(user: any, request?: any) {
    const payload = { sub: user.id, email: user.email, roles: user.roles };
    await this.auditService.create({
      actorUserId: user.id,
      action: AuditAction.USER_LOGIN,
      entityType: 'User',
      entityId: user.id,
      ipAddress: maskIpAddress(request?.ip),
      userAgent: request?.headers?.['user-agent'],
      metadata: { email: user.email },
    });
    return {
      accessToken: await this.jwtService.signAsync(payload),
      user,
    };
  }
}
