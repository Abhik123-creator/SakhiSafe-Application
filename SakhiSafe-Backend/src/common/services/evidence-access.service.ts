import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoleName } from '@prisma/client';
import { UsersRepository } from '../../users/repositories/users.repository';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { extractRoleNames } from '../utils/extract-role-names.util';
import { isEvidenceAccessCodeFormat, normalizeEvidenceAccessCode, verifyEvidenceAccessCode } from '../utils/evidence-access-code.util';

@Injectable()
export class EvidenceAccessService {
  private readonly logger = new Logger(EvidenceAccessService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly configService: ConfigService,
  ) {}

  async assertEvidenceAccess(user: AuthenticatedUser | undefined, accessCode: string | undefined, context: string) {
    const roleNames = extractRoleNames(user);
    if (roleNames.includes(RoleName.SUPER_ADMIN) || roleNames.includes(RoleName.ADMIN)) {
      return;
    }

    const normalizedCode = normalizeEvidenceAccessCode(accessCode);
    if (!user?.id || !isEvidenceAccessCodeFormat(normalizedCode)) {
      this.logger.warn(`[EVIDENCE_ACCESS_DENIED] reason=missing_or_invalid_code userId=${user?.id ?? 'unknown'} context=${context}`);
      throw new ForbiddenException('Evidence access code is required');
    }

    const persistedUser = await this.usersRepository.findById(user.id);
    if (!persistedUser?.evidenceAccessCodeHash) {
      this.logger.warn(`[EVIDENCE_ACCESS_DENIED] reason=code_not_configured userId=${user.id} context=${context}`);
      throw new ForbiddenException('Evidence access code is not configured for this user');
    }

    const isValid = verifyEvidenceAccessCode(normalizedCode, persistedUser.evidenceAccessCodeHash, this.accessCodeSecret());
    if (!isValid) {
      this.logger.warn(`[EVIDENCE_ACCESS_DENIED] reason=code_mismatch userId=${user.id} context=${context}`);
      throw new ForbiddenException('Invalid evidence access code');
    }

    this.logger.log(`[EVIDENCE_ACCESS_GRANTED] userId=${user.id} context=${context}`);
  }

  private accessCodeSecret() {
    const secret = this.configService.get<string>('auth.jwtSecret');
    return typeof secret === 'string' && secret.length ? secret : 'change_this_to_a_long_random_secret';
  }
}
