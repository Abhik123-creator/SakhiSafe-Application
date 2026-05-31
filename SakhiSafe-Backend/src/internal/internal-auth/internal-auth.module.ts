import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { InternalAuthController } from './internal-auth.controller';
import { InternalAuthService } from './internal-auth.service';
import { ServiceJwtGuard } from './service-jwt.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [InternalAuthController],
  providers: [InternalAuthService, ServiceJwtGuard],
  exports: [JwtModule, ServiceJwtGuard],
})
export class InternalAuthModule {}
