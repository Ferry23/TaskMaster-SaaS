import { transporter, EMAIL_SENDER } from '../config/email';
import { getInvitationEmailHtml } from '../utils/emailTemplates';

// Interface for sending an invitation email
interface SendInvitationParams {
    to: string;
    orgName: string;
    inviterName: string;
    inviteLink: string;
    role: string;
}

export const emailService = {
    /**
     * Send an invitation email to a user
     */
    sendInvitation: async ({ to, orgName, inviterName, inviteLink, role }: SendInvitationParams) => {
        try {
            if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
                console.log(`[DEV MODE - NO SMTP CONFIG] Email would be sent to ${to} with link: ${inviteLink}`);
                return { success: true, mock: true };
            }

            const html = getInvitationEmailHtml(orgName, inviterName, inviteLink, role);

            const info = await transporter.sendMail({
                from: EMAIL_SENDER,
                to,
                subject: `Invitation to join ${orgName} on TaskMaster`,
                html,
            });

            console.log(`Email sent: ${info.messageId}`);
            return { success: true, data: info };
        } catch (error) {
            console.error('Failed to send email:', error);
            // Don't throw error to prevent blocking the flow, but return status
            return { success: false, error };
        }
    },

    /**
     * Send a generic email
     */
    sendEmail: async ({ to, subject, html }: { to: string; subject: string; html: string }) => {
        try {
            if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
                console.log(`[DEV MODE - NO SMTP CONFIG] Generic email to ${to}: ${subject}`);
                return { success: true, mock: true };
            }

            const info = await transporter.sendMail({
                from: EMAIL_SENDER,
                to,
                subject,
                html,
            });

            console.log(`Email sent: ${info.messageId}`);
            return { success: true, data: info };
        } catch (error) {
            console.error('Failed to send generic email:', error);
            return { success: false, error };
        }
    }
};
