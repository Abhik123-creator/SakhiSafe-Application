import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipResponseTransform } from '../../common/decorators/skip-response-transform.decorator';
import { ServiceTokenRequestDto } from './dto/service-token-request.dto';
import { ServiceTokenResponseDto } from './dto/service-token-response.dto';
import { InternalAuthService } from './internal-auth.service';

@ApiTags('Internal Auth')
@Controller('internal/v1/auth')
export class InternalAuthController {
  constructor(private readonly internalAuthService: InternalAuthService) {}

  @Post('token')
  @ApiOperation({ summary: 'Generate service JWT token' })
  @ApiBody({ type: ServiceTokenRequestDto })
  @ApiOkResponse({ type: ServiceTokenResponseDto })
  @SkipResponseTransform()
  createToken(@Body() request: ServiceTokenRequestDto) {
    return this.internalAuthService.createToken(request);
  }
}
