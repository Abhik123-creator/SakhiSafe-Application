import { Global, Module } from '@nestjs/common';
import { NESTLENS_MAILER_SERVICE } from 'nestlens';
import { AppMailerService } from './app-mailer.service';

@Global()
@Module({
  providers: [
    AppMailerService,
    {
      provide: NESTLENS_MAILER_SERVICE,
      useExisting: AppMailerService,
    },
  ],
  exports: [AppMailerService, NESTLENS_MAILER_SERVICE],
})
export class MailModule {}
