import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodeMailer from 'nodemailer';
@Injectable()
export class NotificationsService {
  constructor(private readonly configService: ConfigService) {}
  private readonly transporter = nodeMailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: this.configService.getOrThrow('SMTP_USER'),
      clientId: this.configService.getOrThrow('GOOGLE_OAUTH_CLIENT_ID'),
      clientSecret: this.configService.getOrThrow('GOOGLE_OAUTH_CLIENT_SECRET'),
      refreshToken: this.configService.getOrThrow('GOOGLE_REFRESH_TOKEN'),
    },
  });
  async send(email: string, text: string, subject: string) {
    await this.transporter.sendMail({
      from: this.configService.getOrThrow('SMTP_USER'),
      to: email,
      subject: subject,
      text: `${text}`,
    });
  }
}
