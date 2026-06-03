import { ApiProperty } from '@nestjs/swagger';
import { ConversationChannel } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class GetOrCreateActiveSessionDto {
  @ApiProperty()
  @IsUUID()
  careSeekerId: string;

  @ApiProperty({ enum: ConversationChannel })
  @IsEnum(ConversationChannel)
  channel: ConversationChannel;
}
