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
  tls: { rejectUnauthorized: false }, // allow self-signed/mismatched certs from cloud VMs
  connectionTimeout: 8000,
  greetingTimeout:   8000,
  socketTimeout:     8000,
});

// Always create a fresh transporter — never cache, so env var changes are always picked up.
export const getEmailTransporter = () => nodemailer.createTransport(getSmtpConfig());

export const getEmailFromAddress = () =>
  process.env.EMAIL_FROM_ADDRESS || "noreply@zoho.com";
