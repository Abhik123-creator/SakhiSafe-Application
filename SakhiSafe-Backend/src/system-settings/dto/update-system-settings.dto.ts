import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class BrandingSettingsDto {
  @ApiPropertyOptional({ example: 'SakhiSafe-SakhaVasudev' })
  @IsOptional()
  @IsString()
  siteName?: string;

  @ApiPropertyOptional({ example: '/media/LOGO.jpeg' })
  @IsOptional()
  @IsString()
  logoUrl?: string;
}

export class SmtpSettingsDto {
  @ApiPropertyOptional({ example: 'smtp.example.com' })
  @IsOptional()
  @IsString()
  host?: string;

  @ApiPropertyOptional({ example: 587 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ example: 'noreply@example.com' })
  @IsOptional()
  @IsEmail()
  fromEmail?: string;

  @ApiPropertyOptional({ example: 'SakhiSafe Alerts' })
  @IsOptional()
  @IsString()
  fromName?: string;

  @ApiPropertyOptional({ example: 'smtp-user' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Write-only. Existing value is preserved when omitted.' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  useTls?: boolean;
}

export class SecuritySettingsDto {
  @ApiPropertyOptional({ example: 900 })
  @IsOptional()
  @IsInt()
  @Min(300)
  @Max(86400)
  sessionTtlSeconds?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  auditLoggingEnabled?: boolean;
}

export class UpdateSystemSettingsDto {
  @ApiPropertyOptional({ type: BrandingSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BrandingSettingsDto)
  branding?: BrandingSettingsDto;

  @ApiPropertyOptional({ type: SmtpSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SmtpSettingsDto)
  smtp?: SmtpSettingsDto;

  @ApiPropertyOptional({ type: SecuritySettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SecuritySettingsDto)
  security?: SecuritySettingsDto;
}
