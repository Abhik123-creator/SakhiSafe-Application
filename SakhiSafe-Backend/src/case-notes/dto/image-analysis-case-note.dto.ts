import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

export class ImageAnalysisCaseNoteDto {
  @ApiProperty()
  @IsString()
  careSeekerPhone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  caseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  incidentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  whatsappMessageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  whatsappMediaId?: string;

  @ApiPropertyOptional({ default: 'whatsapp' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty()
  @IsString()
  aiAnalysisJson: string;

  @ApiProperty()
  @IsNumberString()
  aiConfidence: string;

  @ApiProperty()
  @IsString()
  aiSummary: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  survivorFriendlySummary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caption?: string;
}
