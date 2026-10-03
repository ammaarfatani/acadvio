// Load dotenv before reading SMTP settings from process.env.
import "../config/env";
import nodemailer from "nodemailer";

export const sendEmailNotification = async (options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL } = process.env;
  const port = Number(SMTP_PORT);

  if (
    !SMTP_HOST?.trim() ||
    !SMTP_PORT?.trim() ||
    !SMTP_USER?.trim() ||
    !SMTP_PASS?.trim() ||
    !FROM_EMAIL?.trim() ||
    !Number.isInteger(port) ||
    port <= 0
  ) {
    console.error("[SMTP] \u{274C} SMTP configuration is incomplete");
    return false;
  }

  console.log("[EMAIL] Sending email via Gmail SMTP");
  console.log(`[EMAIL] To: ${options.to}`);
  console.log(`[EMAIL] Subject: ${options.subject}`);

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: false,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      text: options.text,
      ...(options.html ? { html: options.html } : {}),
    });

    console.log("[EMAIL] \u{2705} Email sent successfully");
    console.log(`[EMAIL] Message ID: ${info.messageId}`);
    return true;
  } catch (error: any) {
    console.error("[EMAIL] \u{274C} Email sending failed");
    console.error(`[EMAIL] To: ${options.to}`);
    console.error(`[EMAIL] Error: ${error?.message || String(error)}`);
    console.error(`[EMAIL] Code: ${error?.code || "Unavailable"}`);
    console.error(`[EMAIL] Response: ${error?.response || "Unavailable"}`);
    return false;
  }
};
