import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ enum: RoleName })
  @IsEnum(RoleName)
  name: RoleName;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
