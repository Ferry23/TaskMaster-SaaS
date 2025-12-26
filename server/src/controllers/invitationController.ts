import { Request, Response } from 'express';
import { db } from '../config/firebase';
import {
    createInvitationSchema,
    generateInvitationToken,
    getInvitationExpiryDate,
    isInvitationValid,
    Invitation
} from '../schemas/invitation';
import { hasPermission } from '../schemas/member';
import { emailService } from '../services/emailService';
import { logActivity } from '../services/activityLogService';
import { getIO } from '../socket';


interface AuthRequest extends Request {
    user?: any;
}

// Helper to get invitation link
const getInvitationLink = (token: string) =>
    `${process.env.CLIENT_URL || 'http://localhost:3000'}/invite/accept?token=${token}`;


// ==================== SEND INVITATION ====================
export const sendInvitation = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params; // organization ID
        const userId = req.user.userId;
        const { email, role } = createInvitationSchema.parse(req.body);

        // Check if user has permission to invite
        const membershipSnapshot = await db.collection('organization_members')
            .where('organizationId', '==', id)
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .get();

        if (membershipSnapshot.empty) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const userRole = membershipSnapshot.docs[0].data().role;

        if (!hasPermission(userRole, 'members:invite')) {
            return res.status(403).json({ message: 'Only owners and admins can invite members' });
        }

        // Check if email is already a member
        const existingMemberSnapshot = await db.collection('organization_members')
            .where('organizationId', '==', id)
            .where('email', '==', email)
            .where('status', '==', 'active')
            .get();

        if (!existingMemberSnapshot.empty) {
            return res.status(400).json({ message: 'User is already a member of this organization' });
        }

        // Check if there's already a pending invitation
        const existingInvitationSnapshot = await db.collection('invitations')
            .where('organizationId', '==', id)
            .where('email', '==', email)
            .where('status', '==', 'pending')
            .get();

        if (!existingInvitationSnapshot.empty) {
            return res.status(400).json({ message: 'An invitation has already been sent to this email' });
        }

        // Get organization info
        const orgDoc = await db.collection('organizations').doc(id).get();
        if (!orgDoc.exists) {
            return res.status(404).json({ message: 'Organization not found' });
        }

        const orgData = orgDoc.data();

        // Check member limit
        const membersCount = await db.collection('organization_members')
            .where('organizationId', '==', id)
            .where('status', '==', 'active')
            .get();

        if (membersCount.size >= (orgData?.maxMembers || 5)) {
            return res.status(400).json({ message: 'Organization has reached maximum member limit' });
        }

        // Create invitation
        const invitationRef = db.collection('invitations').doc();
        const token = generateInvitationToken();
        const expiryDate = getInvitationExpiryDate();

        const invitationData: Invitation = {
            id: invitationRef.id,
            organizationId: id,
            email,
            invitedBy: userId,
            role,
            token,
            status: 'pending',
            expiresAt: expiryDate.toISOString(),
            createdAt: new Date().toISOString(),
        };

        await invitationRef.set(invitationData);

        await invitationRef.set(invitationData);

        // Get inviter details for email
        const inviterDoc = await db.collection('users').doc(userId).get();
        const inviterName = inviterDoc.exists ? (inviterDoc.data()?.name || 'A team member') : 'A team member';

        // Send email notification
        const inviteLink = getInvitationLink(token);

        await emailService.sendInvitation({
            to: email,
            orgName: orgData?.name || 'Unnamed Organization',
            inviterName,
            inviteLink,
            role
        });

        // Log Activity
        logActivity(
            id,
            req.user.userId,
            req.user.email || 'Unknown',
            'INVITATION_SEND',
            'INVITATION',
            invitationRef.id,
            { email, role }
        );

        // Real-time Notification (if user is already registered)
        const userSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();
        if (!userSnapshot.empty) {
            const inviteeId = userSnapshot.docs[0].id;
            getIO().to(inviteeId).emit('notification:invite', {
                message: `You were invited to ${orgData?.name}`,
                organizationId: id,
                by: inviterName
            });
        }

        res.status(201).json({
            message: 'Invitation sent successfully',
            invitation: {
                id: invitationRef.id,
                email,
                role,
                expiresAt: expiryDate.toISOString(),
                invitationLink: inviteLink
            }
        });
    } catch (error: any) {
        console.error('Send invitation error:', error);
        res.status(400).json({ message: error.errors || error.message });
    }
};

// ==================== VALIDATE INVITATION ====================
export const validateInvitation = async (req: Request, res: Response) => {
    try {
        const { token } = req.params;

        // Find invitation by token
        const invitationSnapshot = await db.collection('invitations')
            .where('token', '==', token)
            .get();

        if (invitationSnapshot.empty) {
            return res.status(404).json({ message: 'Invalid invitation token' });
        }

        const invitationDoc = invitationSnapshot.docs[0];
        const invitation = invitationDoc.data() as Invitation;

        // Check if valid
        if (!isInvitationValid(invitation)) {
            return res.status(400).json({
                message: 'Invitation has expired or is no longer valid',
                status: invitation.status
            });
        }

        // Get organization info
        const orgDoc = await db.collection('organizations').doc(invitation.organizationId).get();
        const orgData = orgDoc.exists ? orgDoc.data() : {};

        // Get inviter info
        const inviterDoc = await db.collection('users').doc(invitation.invitedBy).get();
        const inviterData = inviterDoc.exists ? inviterDoc.data() : {};

        res.json({
            valid: true,
            invitation: {
                email: invitation.email,
                role: invitation.role,
                organizationName: orgData?.name || 'Unknown',
                invitedBy: inviterData?.name || 'Unknown',
                expiresAt: invitation.expiresAt
            }
        });
    } catch (error: any) {
        console.error('Validate invitation error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ==================== ACCEPT INVITATION ====================
export const acceptInvitation = async (req: AuthRequest, res: Response) => {
    try {
        const { token } = req.params;
        const userId = req.user.userId;
        const userEmail = req.user.email || '';

        // Find invitation
        const invitationSnapshot = await db.collection('invitations')
            .where('token', '==', token)
            .get();

        if (invitationSnapshot.empty) {
            return res.status(404).json({ message: 'Invalid invitation token' });
        }

        const invitationDoc = invitationSnapshot.docs[0];
        const invitation = invitationDoc.data() as Invitation;

        // Validate invitation
        if (!isInvitationValid(invitation)) {
            return res.status(400).json({ message: 'Invitation has expired or is no longer valid' });
        }

        // Check if email matches (optional, could allow any logged-in user)
        // For flexibility, we'll allow any user to accept if they have the token

        // Check if already a member
        const existingMemberSnapshot = await db.collection('organization_members')
            .where('organizationId', '==', invitation.organizationId)
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .get();

        if (!existingMemberSnapshot.empty) {
            return res.status(400).json({ message: 'You are already a member of this organization' });
        }

        // Add user to organization
        const memberRef = db.collection('organization_members').doc();
        const memberData = {
            id: memberRef.id,
            organizationId: invitation.organizationId,
            userId: userId,
            email: userEmail,
            role: invitation.role,
            status: 'active',
            invitedBy: invitation.invitedBy,
            joinedAt: new Date().toISOString(),
        };

        await memberRef.set(memberData);

        // Mark invitation as accepted
        await invitationDoc.ref.update({
            status: 'accepted'
        });

        // Get organization info for response
        const orgDoc = await db.collection('organizations').doc(invitation.organizationId).get();
        const orgData = orgDoc.data();

        // Log Activity
        logActivity(
            invitation.organizationId,
            userId,
            userEmail,
            'MEMBER_ADD',
            'MEMBER',
            userId,
            { email: userEmail, role: invitation.role, invitedBy: invitation.invitedBy }
        );

        res.json({
            message: 'Invitation accepted successfully',
            organization: {
                id: invitation.organizationId,
                name: orgData?.name,
                role: invitation.role
            }
        });
    } catch (error: any) {
        console.error('Accept invitation error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ==================== DECLINE INVITATION ====================
export const declineInvitation = async (req: Request, res: Response) => {
    try {
        const { token } = req.params;

        // Find invitation
        const invitationSnapshot = await db.collection('invitations')
            .where('token', '==', token)
            .get();

        if (invitationSnapshot.empty) {
            return res.status(404).json({ message: 'Invalid invitation token' });
        }

        const invitationDoc = invitationSnapshot.docs[0];
        const invitation = invitationDoc.data() as Invitation;

        if (invitation.status !== 'pending') {
            return res.status(400).json({ message: 'Invitation is no longer pending' });
        }

        // Mark as revoked (or could delete it)
        await invitationDoc.ref.update({
            status: 'revoked'
        });

        res.json({ message: 'Invitation declined' });
    } catch (error: any) {
        console.error('Decline invitation error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ==================== RESEND INVITATION ====================
export const resendInvitation = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params; // invitation ID
        const userId = req.user.userId;

        // Get invitation
        const invitationDoc = await db.collection('invitations').doc(id).get();

        if (!invitationDoc.exists) {
            return res.status(404).json({ message: 'Invitation not found' });
        }

        const invitation = invitationDoc.data() as Invitation;

        // Check permission
        const membershipSnapshot = await db.collection('organization_members')
            .where('organizationId', '==', invitation.organizationId)
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .get();

        if (membershipSnapshot.empty) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const userRole = membershipSnapshot.docs[0].data().role;

        if (!hasPermission(userRole, 'members:invite')) {
            return res.status(403).json({ message: 'Permission denied' });
        }

        if (invitation.status !== 'pending') {
            return res.status(400).json({ message: 'Can only resend pending invitations' });
        }

        // Update expiry date
        const newExpiryDate = getInvitationExpiryDate();
        await invitationDoc.ref.update({
            expiresAt: newExpiryDate.toISOString()
        });

        // Fetch details for email
        const [orgDoc, inviterDoc] = await Promise.all([
            db.collection('organizations').doc(invitation.organizationId).get(),
            db.collection('users').doc(invitation.invitedBy).get()
        ]);

        const orgName = orgDoc.exists ? orgDoc.data()?.name : 'Organization';
        const inviterName = inviterDoc.exists ? (inviterDoc.data()?.name || 'A team member') : 'A team member';
        const inviteLink = getInvitationLink(invitation.token);

        // Resend email
        await emailService.sendInvitation({
            to: invitation.email,
            orgName: orgName,
            inviterName: inviterName,
            inviteLink: inviteLink,
            role: invitation.role
        });

        res.json({
            message: 'Invitation resent successfully',
            expiresAt: newExpiryDate.toISOString()
        });
    } catch (error: any) {
        console.error('Resend invitation error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ==================== REVOKE INVITATION ====================
export const revokeInvitation = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params; // invitation ID
        const userId = req.user.userId;

        // Get invitation
        const invitationDoc = await db.collection('invitations').doc(id).get();

        if (!invitationDoc.exists) {
            return res.status(404).json({ message: 'Invitation not found' });
        }

        const invitation = invitationDoc.data() as Invitation;

        // Check permission
        const membershipSnapshot = await db.collection('organization_members')
            .where('organizationId', '==', invitation.organizationId)
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .get();

        if (membershipSnapshot.empty) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const userRole = membershipSnapshot.docs[0].data().role;

        if (!hasPermission(userRole, 'members:invite')) {
            return res.status(403).json({ message: 'Permission denied' });
        }

        // Update status or delete
        await invitationDoc.ref.update({
            status: 'revoked'
        });

        res.json({ message: 'Invitation revoked successfully' });
    } catch (error: any) {
        console.error('Revoke invitation error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ==================== LIST PENDING INVITATIONS ====================
export const listPendingInvitations = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params; // organization ID
        const userId = req.user.userId;

        // Check if user is member
        const membershipSnapshot = await db.collection('organization_members')
            .where('organizationId', '==', id)
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .get();

        if (membershipSnapshot.empty) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Get pending invitations
        const invitationsSnapshot = await db.collection('invitations')
            .where('organizationId', '==', id)
            .where('status', '==', 'pending')
            .get();

        const invitations = invitationsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                email: data.email,
                role: data.role,
                invitedBy: data.invitedBy,
                expiresAt: data.expiresAt,
                createdAt: data.createdAt
            };
        });

        res.json({ invitations });
    } catch (error: any) {
        console.error('List invitations error:', error);
        res.status(500).json({ message: error.message });
    }
};
