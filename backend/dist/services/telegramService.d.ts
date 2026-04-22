interface TelegramNotificationOptions {
    title: string;
    message: string;
    details?: Record<string, string | number>;
}
/**
 * Send a notification to the Telegram chat
 */
export declare const sendTelegramNotification: (options: TelegramNotificationOptions) => Promise<boolean>;
/**
 * Send user registration notification
 */
export declare const sendUserRegistrationNotification: (userData: {
    email: string;
    name?: string;
}) => Promise<void>;
/**
 * Send restaurant creation notification
 */
export declare const sendRestaurantCreationNotification: (restaurantData: {
    restaurantName: string;
    address?: string;
    phone?: string;
    country?: string;
    email?: string;
}) => Promise<void>;
export {};
//# sourceMappingURL=telegramService.d.ts.map