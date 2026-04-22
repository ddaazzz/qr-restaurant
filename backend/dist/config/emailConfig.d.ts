import * as nodemailer from "nodemailer";
declare const emailConfig: {
    smtp: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
            user: string | undefined;
            pass: string | undefined;
        };
    };
    from: string;
};
export declare const getEmailTransporter: () => nodemailer.Transporter<any, nodemailer.TransportOptions>;
export declare const getEmailFromAddress: () => string;
export default emailConfig;
//# sourceMappingURL=emailConfig.d.ts.map