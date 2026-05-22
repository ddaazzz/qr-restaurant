import * as nodemailer from "nodemailer";

// Read env vars lazily so dotenv.config() has time to run before these are consumed.
const getSmtpConfig = () => ({
  host: process.env.EMAIL_SMTP_HOST || "smtppro.zoho.com",
  port: parseInt(process.env.EMAIL_SMTP_PORT || "587"),
  secure: process.env.EMAIL_SMTP_SECURE === "true", // true for 465, false for 587
  auth: {
    user: process.env.EMAIL_SMTP_USER || process.env.EMAIL_FROM_ADDRESS,
    pass: process.env.EMAIL_SMTP_PASSWORD,
  },
  connectionTimeout: 10000, // 10s to establish connection
  greetingTimeout:   8000,  // 8s to receive SMTP greeting
  socketTimeout:     10000, // 10s of inactivity before timeout
});

// Transporter is recreated if env vars change (e.g. hot reload in dev).
// In production it is effectively created once.
let transporter: nodemailer.Transporter | null = null;
let cachedUser: string | undefined;

export const getEmailTransporter = () => {
  const cfg = getSmtpConfig();
  // Re-create if credentials have changed (handles dotenv-before-module-load race)
  if (!transporter || cachedUser !== cfg.auth.user) {
    transporter = nodemailer.createTransport(cfg);
    cachedUser = cfg.auth.user;
  }
  return transporter;
};

export const getEmailFromAddress = () =>
  process.env.EMAIL_FROM_ADDRESS || "noreply@zoho.com";

export default emailConfig;
