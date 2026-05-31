import { Controller, Get, NotFoundException, Post, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LoginDto } from '../dto/login.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { AuthService } from '../services/auth.service';

@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @ApiBody({ type: LoginDto })
  login(@Req() request: any) {
    return this.authService.login(request.user, request);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: any) {
    return { user: await this.authService.me(user.id) };
  }

  @Get('debug-permissions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async debugPermissions(@CurrentUser() user: any) {
    if (this.configService.get<string>('app.nodeEnv') === 'production') {
      throw new NotFoundException();
    }

    const currentUser = await this.authService.me(user.id);
    return {
      userId: currentUser.id,
      roles: currentUser.roles,
      isSuperAdmin: currentUser.roles.includes(RoleName.SUPER_ADMIN),
      permissions: currentUser.permissions,
    };
  }
}
