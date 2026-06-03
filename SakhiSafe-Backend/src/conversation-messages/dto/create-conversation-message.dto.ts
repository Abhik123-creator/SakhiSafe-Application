import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationDirection, ConversationMessageType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateConversationMessageDto {
  @ApiProperty()
  @IsUUID()
  sessionId: string;

  @ApiProperty({ enum: ConversationDirection })
  @IsEnum(ConversationDirection)
  direction: ConversationDirection;

  @ApiProperty({ enum: ConversationMessageType })
  @IsEnum(ConversationMessageType)
  messageType: ConversationMessageType;

  @ApiProperty()
  @IsOptional()
  @IsString()
  messageText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  evidenceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  rawPayload?: Record<string, unknown>;
}
