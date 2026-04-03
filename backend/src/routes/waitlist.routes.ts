import express, { Request, Response } from "express";
import { getEmailTransporter, getEmailFromAddress } from "../config/emailConfig";

const router = express.Router();

interface WaitlistSubmission {
  restaurantName: string;
  email: string;
  phone: string;
  message?: string;
}

// Email template for waitlist submission
const getWaitlistTemplate = (data: WaitlistSubmission): string => {
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
          border-bottom: 2px solid #4a90e2;
          padding-bottom: 20px;
          margin-bottom: 20px;
        }
        .header h1 {
          color: #4a90e2;
          margin: 0;
        }
        .content {
          line-height: 1.6;
        }
        .field {
          margin: 15px 0;
          padding: 10px;
          background-color: #f9f9f9;
          border-left: 4px solid #4a90e2;
        }
        .field-label {
          font-weight: bold;
          color: #4a90e2;
          font-size: 0.9em;
          text-transform: uppercase;
        }
        .field-value {
          margin-top: 5px;
          font-size: 1.1em;
        }
        .footer {
          text-align: center;
          border-top: 1px solid #eee;
          margin-top: 30px;
          padding-top: 20px;
          color: #999;
          font-size: 0.9em;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 New Waitlist Submission</h1>
        </div>
        <div class="content">
          <p>A new restaurant has joined the Chuio waitlist!</p>
          
          <div class="field">
            <div class="field-label">Restaurant Name</div>
            <div class="field-value">${escapeHtml(data.restaurantName)}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Contact Email</div>
            <div class="field-value"><a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></div>
          </div>
          
          <div class="field">
            <div class="field-label">Phone Number</div>
            <div class="field-value"><a href="tel:${escapeHtml(data.phone)}">${escapeHtml(data.phone)}</a></div>
          </div>
          
          ${
            data.message
              ? `
          <div class="field">
            <div class="field-label">Additional Message</div>
            <div class="field-value">${escapeHtml(data.message)}</div>
          </div>
          `
              : ""
          }
          
          <p style="margin-top: 30px; color: #666;">
            <strong>Next Steps:</strong><br>
            1. Review the submission<br>
            2. Send personalized welcome email to ${escapeHtml(data.email)}<br>
            3. Schedule demo call if interested<br>
            4. Add to CRM for follow-up
          </p>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from Chuio Waitlist System</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Confirmation template for customer
const getConfirmationTemplate = (restaurantName: string): string => {
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
          margin-bottom: 30px;
        }
        .header h1 {
          color: #4a90e2;
          margin: 0;
        }
        .content {
          line-height: 1.8;
          color: #555;
        }
        .highlight {
          background-color: #e8f4f8;
          padding: 20px;
          border-radius: 5px;
          margin: 20px 0;
          border-left: 4px solid #4a90e2;
        }
        .cta {
          text-align: center;
          margin: 30px 0;
        }
        .cta-button {
          display: inline-block;
          background-color: #4a90e2;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          border-top: 1px solid #eee;
          margin-top: 30px;
          padding-top: 20px;
          color: #999;
          font-size: 0.9em;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Chuio Waitlist! 🎉</h1>
        </div>
        
        <div class="content">
          <p>Hi ${escapeHtml(restaurantName)},</p>
          
          <p>Thank you for joining the Chuio waitlist! We're excited to have you on board and can't wait to revolutionize your restaurant operations.</p>
          
          <div class="highlight">
            <strong>What's Next?</strong><br>
            • Our team will review your submission within 24 hours<br>
            • We'll send you a personalized welcome message<br>
            • Schedule a demo to see Chuio in action<br>
            • Get early access to beta features
          </div>
          
          <p>In the meantime, you can:</p>
          <ul>
            <li>Learn more about our features at <a href="https://chuio.io/">chuio.io</a></li>
            <li>Connect with us on WhatsApp: <a href="https://wa.me/85267455358">+852 6745 5358</a></li>
            <li>Email us directly: support@chuio.io</li>
          </ul>
          
          <p>We're building the future of restaurant management, and we can't do it without partners like you!</p>
          
          <div class="cta">
            <a href="https://chuio.io" class="cta-button">Visit Chuio</a>
          </div>
        </div>
        
        <div class="footer">
          <p>Chuio - Modern QR Code Restaurant Ordering & Management System</p>
          <p>© 2026 Chuio. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Helper function to escape HTML
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// POST /api/waitlist - Submit to waitlist
router.post("/api/waitlist", async (req: Request, res: Response) => {
  try {
    const { restaurantName, email, phone, message } = req.body as WaitlistSubmission;

    // Validate required fields
    if (!restaurantName || !email || !phone) {
      return res.status(400).json({
        error: "Missing required fields: restaurantName, email, phone",
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: "Invalid email address",
      });
    }

    const transporter = getEmailTransporter();
    const fromAddress = getEmailFromAddress();

    // Send email to support@chuio.io
    const supportEmailResult = await transporter.sendMail({
      from: fromAddress,
      to: "support@chuio.io",
      subject: `New Chuio Waitlist Submission: ${restaurantName}`,
      html: getWaitlistTemplate({ restaurantName, email, phone, ...(message ? { message } : {}) }),
      replyTo: email,
    });

    console.log(`✅ Waitlist email sent to support@chuio.io`, {
      messageId: supportEmailResult.messageId,
      restaurantName,
      email,
    });

    // Send confirmation email to customer
    const confirmationEmailResult = await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: "Welcome to Chuio Waitlist - We're excited to have you!",
      html: getConfirmationTemplate(restaurantName),
    });

    console.log(`✅ Confirmation email sent to ${email}`, {
      messageId: confirmationEmailResult.messageId,
    });

    res.json({
      success: true,
      message: "Successfully submitted to waitlist",
      data: {
        restaurantName,
        email,
        phone,
        submittedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("❌ Waitlist submission error:", err);
    res.status(500).json({
      error: "Failed to submit to waitlist",
      details: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

export default router;
