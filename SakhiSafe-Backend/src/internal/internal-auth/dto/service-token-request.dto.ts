import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ServiceTokenRequestDto {
  @ApiProperty({ example: 'sakhi-ai-service' })
  @IsString()
  clientId: string;

  @ApiProperty({ example: 'sakhi_ai_dev_client_secret_9d7b8c6a4f2e1a0c5b3d6e8f1a2c9d0e' })
  @IsString()
  @MinLength(1)
  clientSecret: string;
}
