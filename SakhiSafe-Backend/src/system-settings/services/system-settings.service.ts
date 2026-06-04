import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createHash, randomBytes, randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, resolve } from 'path';
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
    logoUrl: '/logo.jpeg',
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
export interface BrandingUploadFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const BRANDING_UPLOAD_DIR = resolve(process.cwd(), 'private', 'uploads', 'branding');
const MAX_BRANDING_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_BRANDING_MIME_TYPES = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/svg+xml', '.svg'],
  ['image/x-icon', '.ico'],
  ['image/vnd.microsoft.icon', '.ico'],
]);

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

  async getPublicBranding() {
    const settings = await this.getRawSettings();
    return settings.branding;
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
      const nextSmtp = { ...current.smtp, ...this.cleanSmtpSettings(smtp) };
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

  async uploadBrandingLogo(file: BrandingUploadFile | undefined, updatedById?: string) {
    if (!file) {
      throw new BadRequestException('Logo image is required');
    }

    const extension = ALLOWED_BRANDING_MIME_TYPES.get(file.mimetype);
    if (!extension) {
      throw new BadRequestException('Logo must be a PNG, JPEG, WebP, SVG, or ICO image');
    }

    if (file.size > MAX_BRANDING_IMAGE_BYTES) {
      throw new BadRequestException('Logo image must be 2MB or smaller');
    }

    const finalExtension = extension || extname(file.originalname).toLowerCase();
    const fileName = `${randomUUID()}${finalExtension}`;
    await mkdir(BRANDING_UPLOAD_DIR, { recursive: true });
    await writeFile(resolve(BRANDING_UPLOAD_DIR, fileName), file.buffer);

    const logoUrl = `/uploads/branding/${fileName}`;
    const current = await this.getRawSettings();
    await this.repository.upsert(
      SETTING_KEYS.branding,
      { ...current.branding, logoUrl },
      updatedById,
      false,
      'Application shell and authentication branding',
    );

    return {
      logoUrl,
      fileName,
      mimeType: file.mimetype,
      size: file.size,
    };
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

  private cleanSmtpSettings<T extends Record<string, unknown>>(smtp: T) {
    return Object.fromEntries(
      Object.entries(smtp).map(([key, value]) => [key, typeof value === 'string' && value.trim() === '' ? undefined : value]),
    );
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
