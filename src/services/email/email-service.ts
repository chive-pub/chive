/**
 * Email service for sending transactional emails.
 *
 * @remarks
 * Uses nodemailer with SMTP transport for sending emails.
 * Configured for Amazon WorkMail by default.
 *
 * @packageDocumentation
 * @public
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';

import { EmailError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Email send options.
 */
export interface SendEmailOptions {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text?: string;
}

/**
 * Email service configuration.
 */
export interface EmailServiceConfig {
  readonly smtpHost: string;
  readonly smtpPort: number;
  readonly smtpUser: string;
  readonly smtpPassword: string;
  readonly fromAddress: string;
  readonly fromName?: string;
}

/**
 * Email service options.
 */
export interface EmailServiceOptions {
  readonly config: EmailServiceConfig;
  readonly logger: ILogger;
}

/**
 * Email service interface.
 */
export interface IEmailService {
  /**
   * Send an email.
   *
   * @param options - Email options
   */
  sendEmail(options: SendEmailOptions): Promise<void>;

  /**
   * Verify SMTP connection.
   */
  verify(): Promise<boolean>;
}

/**
 * Email service implementation using nodemailer.
 *
 * @public
 */
export class EmailService implements IEmailService {
  private readonly transporter: Transporter<SMTPTransport.SentMessageInfo>;
  private readonly config: EmailServiceConfig;
  private readonly logger: ILogger;

  constructor(options: EmailServiceOptions) {
    this.config = options.config;
    this.logger = options.logger;

    this.transporter = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpPort === 465,
      auth: {
        user: this.config.smtpUser,
        pass: this.config.smtpPassword,
      },
    });
  }

  /**
   * Send an email.
   *
   * @param options - Email options
   * @throws EmailError if sending fails
   */
  async sendEmail(options: SendEmailOptions): Promise<void> {
    const { to, subject, html, text } = options;

    const fromAddress = this.config.fromName
      ? `"${this.config.fromName}" <${this.config.fromAddress}>`
      : this.config.fromAddress;

    try {
      const info = await this.transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
        text: text ?? this.stripHtml(html),
      });

      this.logger.info('Email sent', {
        messageId: info.messageId,
        to,
        subject,
      });
    } catch (error) {
      this.logger.error('Failed to send email', error instanceof Error ? error : undefined);
      throw new EmailError(
        `Failed to send email to ${to}`,
        to,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Verify SMTP connection.
   *
   * @returns true if connection is valid
   */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.info('SMTP connection verified');
      return true;
    } catch (error) {
      this.logger.error('SMTP verification failed', error instanceof Error ? error : undefined);
      return false;
    }
  }

  /**
   * Strip HTML tags for plain text fallback.
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
}

/**
 * Create email service from environment variables.
 *
 * @param logger - Logger instance
 * @returns Email service or null if not configured
 */
export function createEmailServiceFromEnv(logger: ILogger): EmailService | null {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const fromAddress = process.env.EMAIL_FROM;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !fromAddress) {
    logger.warn('Email service not configured: missing environment variables');
    return null;
  }

  return new EmailService({
    config: {
      smtpHost,
      smtpPort: parseInt(smtpPort, 10),
      smtpUser,
      smtpPassword,
      fromAddress,
      fromName: 'Chive',
    },
    logger,
  });
}
