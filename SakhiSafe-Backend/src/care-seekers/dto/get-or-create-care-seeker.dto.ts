import { ApiPropertyOptional } from '@nestjs/swagger';
import { CareSeekerSource } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class GetOrCreateCareSeekerDto {
  @ApiPropertyOptional({ example: '+919999999999' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: '+919999999999' })
  @IsOptional()
  @IsString()
  whatsappPhoneNumber?: string;

  @ApiPropertyOptional({ example: 'WhatsApp Care Seeker' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ enum: CareSeekerSource })
  @IsOptional()
  @IsEnum(CareSeekerSource)
  source?: CareSeekerSource;
}
