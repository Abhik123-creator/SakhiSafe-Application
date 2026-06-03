import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IncidentSource } from '@prisma/client';
import { IsEnum, IsUUID, ValidateNested } from 'class-validator';
import { IncidentLlmOutputDto } from './incident-llm-output.dto';

export class AiUpsertIncidentDto {
  @ApiProperty()
  @IsUUID()
  careSeekerId: string;

  @ApiProperty()
  @IsUUID()
  sessionId: string;

  @ApiProperty({ enum: IncidentSource })
  @IsEnum(IncidentSource)
  source: IncidentSource;

  @ApiProperty({ type: IncidentLlmOutputDto })
  @ValidateNested()
  @Type(() => IncidentLlmOutputDto)
  llmOutput: IncidentLlmOutputDto;
}
