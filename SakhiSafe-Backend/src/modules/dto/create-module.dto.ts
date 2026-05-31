import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModuleKey } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateModuleDto {
  @ApiProperty({ enum: ModuleKey })
  @IsEnum(ModuleKey)
  key: ModuleKey;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
