import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { updateMemberRoleSchema, hasPermission } from '../schemas/member';
import { logActivity } from '../services/activityLogService';

interface AuthRequest extends Request {
    user?: any;
}

// ==================== GET ORGANIZATION MEMBERS ====================
export const getOrganizationMembers = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params; // organization ID
        const userId = req.user.userId;

        // Check if user is member of this organization
        const userMembershipSnapshot = await db.collection('organization_members')
            .where('organizationId', '==', id)
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .get();

        if (userMembershipSnapshot.empty) {
            return res.status(403).json({ message: 'You are not a member of this organization' });
        }

        // Get all active members
        const membersSnapshot = await db.collection('organization_members')
            .where('organizationId', '==', id)
            .where('status', '==', 'active')
            .get();

        // Enrich member data with user info
        const members = [];
        for (const doc of membersSnapshot.docs) {
            const memberData = doc.data();

            // Get user details
            const userDoc = await db.collection('users').doc(memberData.userId).get();
            const userData = userDoc.exists ? userDoc.data() : {};

            members.push({
                id: doc.id,
                userId: memberData.userId,
                email: memberData.email,
                name: userData?.name || 'Unknown',
                role: memberData.role,
                joinedAt: memberData.joinedAt,
                invitedBy: memberData.invitedBy
            });
        }

        res.json({ members });
    } catch (error: any) {
        console.error('Get members error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ==================== UPDATE MEMBER ROLE ====================
export const updateMemberRole = async (req: AuthRequest, res: Response) => {
    try {
        const { id, userId: targetUserId } = req.params; // organization ID, target user ID
        const currentUserId = req.user.userId;
        const { role: newRole } = updateMemberRoleSchema.parse(req.body);

        // Get current user's membership
        const currentUserMembership = await db.collection('organization_members')
            .where('organizationId', '==', id)
            .where('userId', '==', currentUserId)
            .where('status', '==', 'active')
            .get();

        if (currentUserMembership.empty) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const currentUserRole = currentUserMembership.docs[0].data().role;

        // Check permission: only OWNER and ADMIN can change roles
        if (!hasPermission(currentUserRole, 'members:update_role')) {
            return res.status(403).json({ message: 'Only owners and admins can update member roles' });
        }

        // Get target member
        const targetMemberSnapshot = await db.collection('organization_members')
            .where('organizationId', '==', id)
            .where('userId', '==', targetUserId)
            .where('status', '==', 'active')
            .get();

        if (targetMemberSnapshot.empty) {
            return res.status(404).json({ message: 'Member not found' });
        }

        const targetMemberDoc = targetMemberSnapshot.docs[0];
        const targetMemberData = targetMemberDoc.data();

        // Prevent changing owner's role
        if (targetMemberData.role === 'OWNER') {
            return res.status(400).json({ message: 'Cannot change owner role' });
        }

        // Prevent changing own role (except owner can demote themselves)
        if (currentUserId === targetUserId && currentUserRole !== 'OWNER') {
            return res.status(400).json({ message: 'You cannot change your own role' });
        }

        // Update role
        await targetMemberDoc.ref.update({
            role: newRole
        });

        res.json({
            message: 'Member role updated successfully',
            member: {
                userId: targetUserId,
                role: newRole
            }
        });
    } catch (error: any) {
        console.error('Update role error:', error);
        res.status(400).json({ message: error.errors || error.message });
    }
};

// ==================== REMOVE MEMBER ====================
export const removeMember = async (req: AuthRequest, res: Response) => {
    try {
        const { id, userId: targetUserId } = req.params;
        const currentUserId = req.user.userId;

        // Get current user's membership
        const currentUserMembership = await db.collection('organization_members')
            .where('organizationId', '==', id)
            .where('userId', '==', currentUserId)
            .where('status', '==', 'active')
            .get();

        if (currentUserMembership.empty) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const currentUserRole = currentUserMembership.docs[0].data().role;

        // Check permission
        if (!hasPermission(currentUserRole, 'members:remove')) {
            return res.status(403).json({ message: 'Only owners and admins can remove members' });
        }

        // Get target member
        const targetMemberSnapshot = await db.collection('organization_members')
            .where('organizationId', '==', id)
            .where('userId', '==', targetUserId)
            .where('status', '==', 'active')
            .get();

        if (targetMemberSnapshot.empty) {
            return res.status(404).json({ message: 'Member not found' });
        }

        const targetMemberDoc = targetMemberSnapshot.docs[0];
        const targetMemberData = targetMemberDoc.data();

        // Cannot remove owner
        if (targetMemberData.role === 'OWNER') {
            return res.status(400).json({ message: 'Cannot remove organization owner' });
        }

        // Cannot remove yourself (use leave endpoint instead)
        if (currentUserId === targetUserId) {
            return res.status(400).json({ message: 'Use leave endpoint to remove yourself' });
        }

        // Delete member (or set status to inactive)
        await targetMemberDoc.ref.delete();

        // Log Activity
        logActivity(
            id,
            req.user.userId,
            req.user.email || 'Unknown',
            'MEMBER_REMOVE',
            'MEMBER',
            targetUserId,
            { email: targetMemberData.email, removedBy: req.user.email }
        );

        res.json({ message: 'Member removed successfully' });
    } catch (error: any) {
        console.error('Remove member error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ==================== LEAVE ORGANIZATION ====================
export const leaveOrganization = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params; // organization ID
        const userId = req.user.userId;

        // Get user's membership
        const membershipSnapshot = await db.collection('organization_members')
            .where('organizationId', '==', id)
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .get();

        if (membershipSnapshot.empty) {
            return res.status(404).json({ message: 'You are not a member of this organization' });
        }

        const memberDoc = membershipSnapshot.docs[0];
        const memberData = memberDoc.data();

        // Owner cannot leave (must delete organization or transfer ownership first)
        if (memberData.role === 'OWNER') {
            return res.status(400).json({
                message: 'Owner cannot leave organization. Please delete the organization or transfer ownership first.'
            });
        }

        // Delete membership
        await memberDoc.ref.delete();

        // Log Activity
        logActivity(
            id,
            userId,
            req.user.email || 'Unknown',
            'MEMBER_LEAVE',
            'MEMBER',
            userId,
            { email: req.user.email }
        );

        res.json({ message: 'Successfully left organization' });
    } catch (error: any) {
        console.error('Leave organization error:', error);
        res.status(500).json({ message: error.message });
    }
};
