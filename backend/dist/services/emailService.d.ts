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
/**
 * Send receipt email to customer
 */
export declare const sendReceipt: (options: ReceiptEmailOptions) => Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
}>;
/**
 * Send order confirmation email
 */
export declare const sendOrderConfirmation: (options: OrderConfirmationOptions) => Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
}>;
/**
 * Send email verification code for registration
 */
export declare const sendVerificationCode: (email: string, code: string) => Promise<boolean>;
/**
 * Send password reset email with link
 */
export declare const sendPasswordResetEmail: (email: string, resetUrl: string) => Promise<boolean>;
/**
 * Verify SMTP connection (for testing)
 */
export declare const verifyEmailConnection: () => Promise<boolean>;
declare const _default: {
    sendReceipt: (options: ReceiptEmailOptions) => Promise<{
        success: boolean;
        messageId?: string;
        error?: string;
    }>;
    sendOrderConfirmation: (options: OrderConfirmationOptions) => Promise<{
        success: boolean;
        messageId?: string;
        error?: string;
    }>;
    sendVerificationCode: (email: string, code: string) => Promise<boolean>;
    sendPasswordResetEmail: (email: string, resetUrl: string) => Promise<boolean>;
    verifyEmailConnection: () => Promise<boolean>;
};
export default _default;
//# sourceMappingURL=emailService.d.ts.map