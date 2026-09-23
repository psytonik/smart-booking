import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodeMailer from 'nodemailer';
import { EmailJob } from './notifications.constants';

/** Sends one email over Gmail OAuth2 SMTP. Called by the queue worker. */
@Injectable()
export class EmailSender {
  private readonly transporter: nodeMailer.Transporter;
  private readonly from: string;

  constructor(configService: ConfigService) {
    this.from = configService.getOrThrow('SMTP_USER');
    this.transporter = nodeMailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: this.from,
        clientId: configService.getOrThrow('GOOGLE_OAUTH_CLIENT_ID'),
        clientSecret: configService.getOrThrow('GOOGLE_OAUTH_CLIENT_SECRET'),
        refreshToken: configService.getOrThrow('GOOGLE_REFRESH_TOKEN'),
      },
    });
  }

  async send(email: EmailJob): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: email.to,
      subject: email.subject,
      text: email.text,
    });
  }
}
