import { z } from 'zod';
import { memberRoleSchema } from './member';

// ==================== INVITATION SCHEMA ====================

export const invitationStatusSchema = z.enum(['pending', 'accepted', 'expired', 'revoked']);

export const createInvitationSchema = z.object({
    email: z.string().email('Invalid email address'),
    role: memberRoleSchema.exclude(['OWNER']), // OWNER tidak bisa di-invite
});

export const invitationFilterSchema = z.object({
    status: invitationStatusSchema.optional(),
    organizationId: z.string().optional(),
});

// ==================== TYPES ====================

export type InvitationStatus = z.infer<typeof invitationStatusSchema>;

export interface Invitation {
    id: string;
    organizationId: string;
    email: string;
    invitedBy: string;
    role: 'ADMIN' | 'MEMBER' | 'VIEWER';
    token: string;
    status: InvitationStatus;
    expiresAt: string;
    createdAt: string;
}

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

// ==================== HELPERS ====================

/**
 * Generate secure random token untuk invitation
 */
export function generateInvitationToken(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Calculate expiry date (7 hari dari sekarang)
 */
export function getInvitationExpiryDate(): Date {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);
    return expiryDate;
}

/**
 * Check apakah invitation masih valid
 */
export function isInvitationValid(invitation: Invitation): boolean {
    if (invitation.status !== 'pending') {
        return false;
    }

    const now = new Date();
    const expiryDate = new Date(invitation.expiresAt);

    return now < expiryDate;
}
