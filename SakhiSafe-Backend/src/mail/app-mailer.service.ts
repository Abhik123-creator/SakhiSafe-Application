import { Injectable, Logger } from '@nestjs/common';

type MailAddress = string | string[];

export interface SendMailOptions {
  to: MailAddress;
  from?: string;
  subject: string;
  text?: string;
  html?: string;
}

@Injectable()
export class AppMailerService {
  private readonly logger = new Logger(AppMailerService.name);

  async sendMail(options: SendMailOptions) {
    const messageId = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    this.logger.log(
      `[MAIL_QUEUED] messageId=${messageId} to=${this.maskRecipients(options.to)} subject="${this.safeSubject(options.subject)}" transport=nestlens_dev_capture`,
    );

    return {
      accepted: Array.isArray(options.to) ? options.to : [options.to],
      rejected: [],
      messageId,
      envelope: {
        from: options.from,
        to: options.to,
      },
    };
  }

  private maskRecipients(recipients: MailAddress) {
    const list = Array.isArray(recipients) ? recipients : [recipients];
    return list.map((recipient) => this.maskEmail(recipient)).join(',');
  }

  private maskEmail(email: string) {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) {
      return '[redacted-recipient]';
    }

    return `${localPart.slice(0, 1)}***@${domain}`;
  }

  private safeSubject(subject: string) {
    return subject.replace(/[\r\n"]/g, ' ').slice(0, 120);
  }
}
