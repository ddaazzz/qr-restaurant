import { getEmailTransporter, getEmailFromAddress } from "../config/emailConfig";

interface ReceiptEmailOptions {
  toEmail: string;
  orderNumber: string | number;
  content: string;
  restaurantName?: string;
}

interface OrderConfirmationOptions {
  toEmail: string;
  orderNumber: string | number;
  orderData: {
    items?: string[];
    total?: number;
    restaurantName?: string;
  };
}

// HTML receipt template
const getReceiptTemplate = (
  orderNumber: string | number,
  content: string,
  restaurantName: string = "Restaurant"
): string => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Arial', sans-serif;
          background-color: #f5f5f5;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #ffffff;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #3498db;
          padding-bottom: 20px;
          margin-bottom: 20px;
        }
        .header h1 {
          margin: 0;
          color: #2c3e50;
          font-size: 24px;
        }
        .order-number {
          color: #7f8c8d;
          font-size: 14px;
          margin-top: 5px;
        }
        .content {
          line-height: 1.6;
          color: #555;
        }
        .footer {
          border-top: 2px solid #ecf0f1;
          margin-top: 30px;
          padding-top: 20px;
          text-align: center;
          color: #7f8c8d;
          font-size: 12px;
        }
        .receipt-text {
          white-space: pre-wrap;
          font-family: 'Courier New', monospace;
          background-color: #f9f9f9;
          padding: 15px;
          border-radius: 4px;
          border-left: 4px solid #3498db;
          margin: 15px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${restaurantName}</h1>
          <div class="order-number">Order #${orderNumber}</div>
        </div>
        <div class="content">
          <p>Thank you for your order!</p>
          <div class="receipt-text">${content}</div>
          <p>If you have any questions, please don't hesitate to reach out to us.</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Send receipt email to customer
 */
export const sendReceipt = async (options: ReceiptEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    const transporter = getEmailTransporter();
    const fromAddress = getEmailFromAddress();

    const htmlContent = getReceiptTemplate(
      options.orderNumber,
      options.content,
      options.restaurantName || "Restaurant"
    );

    const mailOptions = {
      from: fromAddress,
      to: options.toEmail,
      subject: `Receipt for Order #${options.orderNumber}`,
      html: htmlContent,
      text: `Receipt for Order #${options.orderNumber}\n\n${options.content}`,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Receipt sent to ${options.toEmail}. Message ID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error(`❌ Failed to send receipt to ${options.toEmail}:`, error);
    return {
      success: false,
      error: error.message || "Failed to send email",
    };
  }
};

/**
 * Send order confirmation email
 */
export const sendOrderConfirmation = async (
  options: OrderConfirmationOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    const transporter = getEmailTransporter();
    const fromAddress = getEmailFromAddress();

    const itemsList = options.orderData.items?.length
      ? options.orderData.items.map((item) => `• ${item}`).join("\n")
      : "No items";

    const content = `
Order #${options.orderNumber}
${options.orderData.restaurantName || "Restaurant"}

Items:
${itemsList}

Total: $${options.orderData.total?.toFixed(2) || "0.00"}

Thank you for your order!
    `.trim();

    const htmlContent = getReceiptTemplate(
      options.orderNumber,
      content,
      options.orderData.restaurantName
    );

    const mailOptions = {
      from: fromAddress,
      to: options.toEmail,
      subject: `Order Confirmation #${options.orderNumber}`,
      html: htmlContent,
      text: content,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Order confirmation sent to ${options.toEmail}. Message ID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error(`❌ Failed to send order confirmation to ${options.toEmail}:`, error);
    return {
      success: false,
      error: error.message || "Failed to send email",
    };
  }
};

/**
 * Send email verification code for registration
 */
export const sendVerificationCode = async (email: string, code: string): Promise<boolean> => {
  try {
    const transporter = getEmailTransporter();
    const fromAddress = getEmailFromAddress();

    await transporter.sendMail({
      from: `"Chuio" <${fromAddress}>`,
      to: email,
      subject: "Your Chuio Verification Code",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 24px; color: #1f2937; margin: 0 0 8px;">Verify Your Email</h1>
            <p style="color: #6b7280; font-size: 14px; margin: 0;">Enter this code to complete your registration</p>
          </div>
          <div style="background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #f97316;">${code}</span>
          </div>
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">This code expires in 10 minutes. If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 11px; text-align: center;">&copy; 2026 Chuio. All rights reserved.</p>
        </div>
      `,
    });

    console.log(`[Email] Verification code sent to ${email}`);
    return true;
  } catch (error: any) {
    console.error("[Email] Failed to send verification code:", error.message);
    return false;
  }
};

/**
 * Send password reset email with link
 */
export const sendPasswordResetEmail = async (email: string, resetUrl: string): Promise<boolean> => {
  try {
    const transporter = getEmailTransporter();
    const fromAddress = getEmailFromAddress();

    await transporter.sendMail({
      from: `"Chuio" <${fromAddress}>`,
      to: email,
      subject: "Reset Your Chuio Password",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 24px; color: #1f2937; margin: 0 0 8px;">Reset Your Password</h1>
            <p style="color: #6b7280; font-size: 14px; margin: 0;">Click the button below to set a new password</p>
          </div>
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${resetUrl}" style="display: inline-block; background: #f97316; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">Reset Password</a>
          </div>
          <p style="color: #6b7280; font-size: 13px; text-align: center;">Or copy this link:<br/><a href="${resetUrl}" style="color: #f97316; word-break: break-all;">${resetUrl}</a></p>
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">This link expires in 1 hour. If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 11px; text-align: center;">&copy; 2026 Chuio. All rights reserved.</p>
        </div>
      `,
    });

    console.log(`[Email] Password reset email sent to ${email}`);
    return true;
  } catch (error: any) {
    console.error("[Email] Failed to send password reset email:", error.message);
    return false;
  }
};

/**
 * Verify SMTP connection (for testing)
 */
export const verifyEmailConnection = async (): Promise<boolean> => {
  try {
    const transporter = getEmailTransporter();
    await transporter.verify();
    console.log("✅ Email service verified successfully");
    return true;
  } catch (error: any) {
    console.error("❌ Email service verification failed:", error.message);
    return false;
  }
};

export default {
  sendReceipt,
  sendOrderConfirmation,
  sendVerificationCode,
  sendPasswordResetEmail,
  verifyEmailConnection,
};
