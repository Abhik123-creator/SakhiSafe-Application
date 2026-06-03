import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EvidenceSource, EvidenceUploadedBy } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class UploadImageEvidenceDto {
  @ApiProperty()
  @IsUUID()
  careSeekerId: string;

  @ApiProperty()
  @IsUUID()
  sessionId: string;

  @ApiProperty()
  @IsUUID()
  incidentId: string;

  @ApiProperty({ enum: EvidenceSource })
  @IsEnum(EvidenceSource)
  source: EvidenceSource;

  @ApiProperty({ enum: EvidenceUploadedBy })
  @IsEnum(EvidenceUploadedBy)
  uploadedBy: EvidenceUploadedBy;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
