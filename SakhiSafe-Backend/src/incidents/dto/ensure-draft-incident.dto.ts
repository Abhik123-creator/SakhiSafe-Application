import { ApiProperty } from '@nestjs/swagger';
import { IncidentSource } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class EnsureDraftIncidentDto {
  @ApiProperty()
  @IsUUID()
  careSeekerId: string;

  @ApiProperty()
  @IsUUID()
  sessionId: string;

  @ApiProperty({ enum: IncidentSource })
  @IsEnum(IncidentSource)
  source: IncidentSource;
}
