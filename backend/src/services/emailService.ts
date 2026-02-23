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
  verifyEmailConnection,
};
