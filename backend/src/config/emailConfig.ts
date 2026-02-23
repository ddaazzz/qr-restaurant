import * as nodemailer from "nodemailer";

const emailConfig = {
  smtp: {
    host: process.env.EMAIL_SMTP_HOST || "smtp.zoho.com",
    port: parseInt(process.env.EMAIL_SMTP_PORT || "587"),
    secure: process.env.EMAIL_SMTP_SECURE === "true" ? true : false, // true for 465, false for 587
    auth: {
      user: process.env.EMAIL_SMTP_USER || process.env.EMAIL_FROM_ADDRESS,
      pass: process.env.EMAIL_SMTP_PASSWORD,
    },
  },
  from: process.env.EMAIL_FROM_ADDRESS || "noreply@zoho.com",
};

// Create transporter once (reusable)
let transporter: nodemailer.Transporter | null = null;

export const getEmailTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport(emailConfig.smtp);
  }
  return transporter;
};

export const getEmailFromAddress = () => emailConfig.from;

export default emailConfig;
