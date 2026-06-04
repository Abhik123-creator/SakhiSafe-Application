import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { SystemMaintenanceAction } from '../dto/system-maintenance.dto';
import { UpdateSystemSettingsDto } from '../dto/update-system-settings.dto';
import { SystemSettingsRepository } from '../repositories/system-settings.repository';

const SETTING_KEYS = {
  branding: 'branding',
  smtp: 'smtp',
  security: 'security',
} as const;

const DEFAULT_SETTINGS = {
  branding: {
    siteName: 'SakhiSafe-SakhaVasudev',
    logoUrl: '/media/LOGO.jpeg',
  },
  smtp: {
    host: '',
    port: 587,
    fromEmail: '',
    fromName: '',
    username: '',
    passwordEncrypted: '',
    useTls: true,
  },
  security: {
    sessionTtlSeconds: 900,
    auditLoggingEnabled: true,
  },
};

type SettingsKey = keyof typeof DEFAULT_SETTINGS;

@Injectable()
export class SystemSettingsService {
  constructor(
    private readonly repository: SystemSettingsRepository,
    private readonly configService: ConfigService,
  ) {}

  async getSettings() {
    const records = await this.repository.findAll();
    const byKey = new Map(records.map((record) => [record.key, record.value]));
    const settings = {
      branding: this.mergeSetting('branding', byKey.get(SETTING_KEYS.branding)),
      smtp: this.mergeSetting('smtp', byKey.get(SETTING_KEYS.smtp)),
      security: this.mergeSetting('security', byKey.get(SETTING_KEYS.security)),
    };

    return this.redact(settings);
  }

  async updateSettings(dto: UpdateSystemSettingsDto, updatedById?: string) {
    const current = await this.getRawSettings();

    if (dto.branding) {
      await this.repository.upsert(
        SETTING_KEYS.branding,
        { ...current.branding, ...dto.branding },
        updatedById,
        false,
        'Application shell and authentication branding',
      );
    }

    if (dto.smtp) {
      const { password, ...smtp } = dto.smtp;
      const nextSmtp = { ...current.smtp, ...smtp };
      if (password?.trim()) {
        nextSmtp.passwordEncrypted = this.encryptSecret(password);
      }
      await this.repository.upsert(
        SETTING_KEYS.smtp,
        nextSmtp,
        updatedById,
        true,
        'Outbound email delivery configuration',
      );
    }

    if (dto.security) {
      await this.repository.upsert(
        SETTING_KEYS.security,
        { ...current.security, ...dto.security },
        updatedById,
        false,
        'Dashboard security controls',
      );
    }

    return this.getSettings();
  }

  getSystemInfo() {
    return {
      appName: this.configService.get<string>('app.name') ?? 'SakhiSafe Backend',
      environment: process.env.NODE_ENV ?? 'development',
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  requestMaintenance(action: SystemMaintenanceAction) {
    return {
      action,
      status: 'RECORDED',
      message: 'Maintenance request recorded for super admin review. No shell command was executed by this API.',
      requestedAt: new Date().toISOString(),
    };
  }

  private async getRawSettings() {
    const records = await this.repository.findAll();
    const byKey = new Map(records.map((record) => [record.key, record.value]));
    return {
      branding: this.mergeSetting('branding', byKey.get(SETTING_KEYS.branding)),
      smtp: this.mergeSetting('smtp', byKey.get(SETTING_KEYS.smtp)),
      security: this.mergeSetting('security', byKey.get(SETTING_KEYS.security)),
    };
  }

  private mergeSetting<T extends SettingsKey>(key: T, value: Prisma.JsonValue | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ...DEFAULT_SETTINGS[key] };
    }
    return { ...DEFAULT_SETTINGS[key], ...(value as Record<string, unknown>) };
  }

  private redact(settings: typeof DEFAULT_SETTINGS) {
    const { passwordEncrypted, ...smtp } = settings.smtp;
    return {
      ...settings,
      smtp: {
        ...smtp,
        passwordConfigured: Boolean(passwordEncrypted),
      },
    };
  }

  private encryptSecret(secret: string) {
    const iv = randomBytes(12);
    const keyMaterial =
      this.configService.get<string>('SYSTEM_SETTINGS_SECRET') ??
      this.configService.get<string>('auth.jwtSecret') ??
      'development-system-settings-secret';
    const key = createHash('sha256').update(keyMaterial).digest();
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`;
  }
}
