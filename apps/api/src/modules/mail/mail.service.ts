import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { Env } from "../../config/env.validation";

@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService<Env, true>) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get("SMTP_HOST", { infer: true }),
      port: this.configService.get("SMTP_PORT", { infer: true }),
      secure: false,
    });
    this.from = this.configService.get("SMTP_FROM", { infer: true });
  }

  async sendMail(to: string, subject: string, text: string): Promise<void> {
    await this.transporter.sendMail({ from: this.from, to, subject, text });
  }
}
