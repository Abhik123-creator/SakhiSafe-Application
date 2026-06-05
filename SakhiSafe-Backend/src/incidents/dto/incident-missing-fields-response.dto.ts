import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IncidentMissingFieldsResponseDto {
  @ApiProperty({ example: 'a5e4d65c-8b51-4f6b-a6fd-5c3f27f1c7a9' })
  incidentId: string;

  @ApiProperty({ example: '89a0da54-9170-464d-bda8-bc805271d57a' })
  careSeekerId: string;

  @ApiPropertyOptional({ example: '71a96d84-6fc8-4386-9a99-38b5ee1d7953', nullable: true })
  sessionId?: string | null;

  @ApiProperty({ example: '919999999999' })
  phoneNumber: string;

  @ApiProperty({ example: 'OPEN' })
  status: string;

  @ApiProperty({ example: 'Reported domestic violence concern' })
  title: string;

  @ApiProperty({ type: [String], example: ['Current safety status', 'Location details'] })
  missingFields: string[];

  @ApiProperty({ example: '2026-06-05T03:30:00.000Z' })
  updatedAt: Date;
}
