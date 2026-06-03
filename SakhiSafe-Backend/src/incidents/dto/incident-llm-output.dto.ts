import { ApiPropertyOptional } from '@nestjs/swagger';
import { IncidentCategory, IncidentSeverity, IncidentUrgency } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class IncidentLlmOutputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: IncidentCategory })
  @IsOptional()
  @IsEnum(IncidentCategory)
  category?: IncidentCategory;

  @ApiPropertyOptional({ enum: IncidentSeverity })
  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @ApiPropertyOptional({ enum: IncidentUrgency })
  @IsOptional()
  @IsEnum(IncidentUrgency)
  urgency?: IncidentUrgency;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  incidentDateText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  perpetratorRelation?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  riskSignals?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  missingFields?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  needsHumanReview?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  aiConfidence?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caseNote?: string;
}
