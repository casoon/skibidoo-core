import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "@/config/env";
import { logger } from "@/config/logger";

let transporter: Transporter | null = null;

export function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      } : undefined,
    });
  }
  return transporter;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ messageId: string }> {
  const transport = getTransporter();

  const from = options.from || env.SMTP_FROM || "noreply@skibidoo.de";

  try {
    const result = await transport.sendMail({
      from,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
      attachments: options.attachments,
    });

    logger.info(
      { messageId: result.messageId, to: options.to, subject: options.subject },
      "Email sent successfully"
    );

    return { messageId: result.messageId };
  } catch (err) {
    logger.error({ err, to: options.to, subject: options.subject }, "Failed to send email");
    throw err;
  }
}

export async function verifyConnection(): Promise<boolean> {
  try {
    const transport = getTransporter();
    await transport.verify();
    logger.info("SMTP connection verified");
    return true;
  } catch (err) {
    logger.error({ err }, "SMTP connection verification failed");
    return false;
  }
}
