import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoleName } from '@prisma/client';
import {
  generateEvidenceAccessCode,
  hashEvidenceAccessCode,
} from '../../common/utils/evidence-access-code.util';
import { hashPassword } from '../../common/utils/password.util';
import { AppMailerService } from '../../mail/app-mailer.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UsersRepository } from '../repositories/users.repository';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly configService: ConfigService,
    private readonly mailerService: AppMailerService,
  ) {}

  findAll() {
    return this.usersRepository.findAll().then((users) => users.map((user) => this.toPublicUser(user)));
  }

  async findById(id: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException();
    }
    return user;
  }

  findByEmail(email: string) {
    return this.usersRepository.findByEmail(email);
  }

  async create(dto: CreateUserDto) {
    const passwordHash = await hashPassword(dto.password, this.configService.get<number>('auth.bcryptSaltRounds') ?? 10);
    const roles = dto.roles ?? [RoleName.ORGANIZATION];
    const evidenceAccessCode = await this.generateEvidenceAccessCodeForRoles(roles);
    const createdUser = await this.usersRepository.create(
      {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        evidenceAccessCodeHash: evidenceAccessCode
          ? hashEvidenceAccessCode(evidenceAccessCode, this.accessCodeSecret())
          : undefined,
        evidenceAccessCodeIssuedAt: evidenceAccessCode ? new Date() : undefined,
        organization: dto.organizationId ? { connect: { id: dto.organizationId } } : undefined,
      },
      roles,
    );

    if (evidenceAccessCode && createdUser) {
      await this.sendEvidenceAccessCodeEmail(createdUser, evidenceAccessCode);
      this.logger.log(`[USER_EVIDENCE_ACCESS_CODE_ISSUED] userId=${createdUser.id} delivery=email`);
    }

    return this.toPublicUser(createdUser);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.usersRepository.update(id, {
      email: dto.email,
      fullName: dto.fullName,
      phone: dto.phone,
      organization: dto.organizationId ? { connect: { id: dto.organizationId } } : undefined,
    });
    return this.toPublicUser(user);
  }

  async delete(id: string) {
    const user = await this.usersRepository.softDelete(id);
    return this.toPublicUser(user);
  }

  toSafeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      name: user.fullName,
      roles: user.roles?.map((userRole) => userRole.role.name) ?? [],
      organizationId: user.organizationId,
    };
  }

  toPublicUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.fullName,
      fullName: user.fullName,
      phone: user.phone,
      organizationId: user.organizationId,
      organization: user.organization,
      roles: user.roles,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      evidenceAccessCodeIssuedAt: user.evidenceAccessCodeIssuedAt,
    };
  }

  private requiresEvidenceAccessCode(roles: RoleName[]) {
    return !roles.includes(RoleName.SUPER_ADMIN) && !roles.includes(RoleName.ADMIN);
  }

  private accessCodeSecret() {
    const secret = this.configService.get<string>('auth.jwtSecret');
    return typeof secret === 'string' && secret.length ? secret : 'change_this_to_a_long_random_secret';
  }

  private async generateEvidenceAccessCodeForRoles(roles: RoleName[]) {
    if (!this.requiresEvidenceAccessCode(roles)) {
      return null;
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = generateEvidenceAccessCode();
      const existing = await this.usersRepository.findByEvidenceAccessCodeHash(
        hashEvidenceAccessCode(code, this.accessCodeSecret()),
      );
      if (!existing) {
        return code;
      }
    }

    throw new Error('Could not generate a unique evidence access code');
  }

  private async sendEvidenceAccessCodeEmail(user: any, evidenceAccessCode: string) {
    await this.mailerService.sendMail({
      to: user.email,
      from: 'SakhiSafe <no-reply@sakhisafe.local>',
      subject: 'Your SakhiSafe evidence access code',
      text: [
        `Hello ${user.fullName ?? 'SakhiSafe user'},`,
        '',
        'Your evidence access code is:',
        evidenceAccessCode,
        '',
        'Use this code only when accessing submitted evidence or downloading case report PDFs.',
        'Do not share it in chat, screenshots, or support messages.',
        '',
        'SakhiSafe',
      ].join('\n'),
      html: [
        `<p>Hello ${this.escapeHtml(user.fullName ?? 'SakhiSafe user')},</p>`,
        '<p>Your evidence access code is:</p>',
        `<p style="font-size: 24px; letter-spacing: 0.25em; font-weight: 700;">${evidenceAccessCode}</p>`,
        '<p>Use this code only when accessing submitted evidence or downloading case report PDFs.</p>',
        '<p>Do not share it in chat, screenshots, or support messages.</p>',
        '<p>SakhiSafe</p>',
      ].join(''),
    });
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
