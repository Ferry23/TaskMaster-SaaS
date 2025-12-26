import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { organizationSchema, updateOrganizationSchema, Organization } from '../schemas/organization';

interface AuthRequest extends Request {
    user?: any;
}

// ==================== CREATE ORGANIZATION ====================
export const createOrganization = async (req: AuthRequest, res: Response) => {
    try {
        const validatedData = organizationSchema.parse(req.body);
        const userId = req.user.userId;

        // Create organization
        const orgRef = db.collection('organizations').doc();
        const organizationData = {
            id: orgRef.id,
            name: validatedData.name,
            ownerId: userId,
            plan: validatedData.plan,
            maxMembers: validatedData.maxMembers,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        await orgRef.set(organizationData);

        // Add creator as OWNER in organization_members
        const memberRef = db.collection('organization_members').doc();
        const memberData = {
            id: memberRef.id,
            organizationId: orgRef.id,
            userId: userId,
            email: req.user.email || '',
            role: 'OWNER',
            status: 'active',
            invitedBy: userId, // Self-invited (creator)
            joinedAt: new Date().toISOString(),
        };

        await memberRef.set(memberData);

        res.status(201).json({
            message: 'Organization created successfully',
            organization: { ...organizationData, id: orgRef.id }
        });
    } catch (error: any) {
        console.error('Create organization error:', error);
        res.status(400).json({ message: error.errors || error.message });
    }
};

// ==================== GET MY ORGANIZATIONS ====================
export const getMyOrganizations = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user.userId;

        // Get all organizations where user is a member
        const membershipsSnapshot = await db.collection('organization_members')
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .get();

        if (membershipsSnapshot.empty) {
            return res.json({ organizations: [] });
        }

        // Extract organization IDs
        const orgIds = membershipsSnapshot.docs.map(doc => doc.data().organizationId);

        // Get organization details
        const organizations = [];
        for (const orgId of orgIds) {
            const orgDoc = await db.collection('organizations').doc(orgId).get();
            if (orgDoc.exists) {
                const orgData = orgDoc.data();

                // Get user's role in this organization
                const membership = membershipsSnapshot.docs.find(
                    doc => doc.data().organizationId === orgId
                );

                organizations.push({
                    ...orgData,
                    id: orgDoc.id,
                    role: membership?.data().role,
                    isOwner: orgData?.ownerId === userId
                });
            }
        }

        res.json({ organizations });
    } catch (error: any) {
        console.error('Get organizations error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ==================== GET ORGANIZATION BY ID ====================
export const getOrganizationById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        // Check if user is member
        const membershipSnapshot = await db.collection('organization_members')
            .where('organizationId', '==', id)
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .get();

        if (membershipSnapshot.empty) {
            return res.status(403).json({ message: 'You are not a member of this organization' });
        }

        // Get organization data
        const orgDoc = await db.collection('organizations').doc(id).get();

        if (!orgDoc.exists) {
            return res.status(404).json({ message: 'Organization not found' });
        }

        const orgData = orgDoc.data();
        const membership = membershipSnapshot.docs[0].data();

        // Get member count
        const membersSnapshot = await db.collection('organization_members')
            .where('organizationId', '==', id)
            .where('status', '==', 'active')
            .get();

        res.json({
            ...orgData,
            id: orgDoc.id,
            role: membership.role,
            isOwner: orgData?.ownerId === userId,
            memberCount: membersSnapshot.size,
        });
    } catch (error: any) {
        console.error('Get organization error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ==================== UPDATE ORGANIZATION ====================
export const updateOrganization = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const updates = updateOrganizationSchema.parse(req.body);

        // Check if user is owner or admin
        const membershipSnapshot = await db.collection('organization_members')
            .where('organizationId', '==', id)
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .get();

        if (membershipSnapshot.empty) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const userRole = membershipSnapshot.docs[0].data().role;

        if (userRole !== 'OWNER' && userRole !== 'ADMIN') {
            return res.status(403).json({ message: 'Only owners and admins can update organization' });
        }

        // Update organization
        const orgRef = db.collection('organizations').doc(id);
        await orgRef.update({
            ...updates,
            updatedAt: new Date().toISOString()
        });

        const updatedOrg = await orgRef.get();

        res.json({
            message: 'Organization updated successfully',
            organization: { ...updatedOrg.data(), id: updatedOrg.id }
        });
    } catch (error: any) {
        console.error('Update organization error:', error);
        res.status(400).json({ message: error.errors || error.message });
    }
};

// ==================== DELETE ORGANIZATION ====================
export const deleteOrganization = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        // Get organization
        const orgDoc = await db.collection('organizations').doc(id).get();

        if (!orgDoc.exists) {
            return res.status(404).json({ message: 'Organization not found' });
        }

        const orgData = orgDoc.data();

        // Only owner can delete
        if (orgData?.ownerId !== userId) {
            return res.status(403).json({ message: 'Only owner can delete organization' });
        }

        // Delete all members
        const membersSnapshot = await db.collection('organization_members')
            .where('organizationId', '==', id)
            .get();

        const memberDeletePromises = membersSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(memberDeletePromises);

        // Delete all invitations
        const invitationsSnapshot = await db.collection('invitations')
            .where('organizationId', '==', id)
            .get();

        const invitationDeletePromises = invitationsSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(invitationDeletePromises);

        // Delete all team tasks (optional - atau bisa di-archive)
        const tasksSnapshot = await db.collection('tasks')
            .where('organizationId', '==', id)
            .get();

        const taskDeletePromises = tasksSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(taskDeletePromises);

        // Finally, delete organization
        await orgDoc.ref.delete();

        res.json({ message: 'Organization deleted successfully' });
    } catch (error: any) {
        console.error('Delete organization error:', error);
        res.status(500).json({ message: error.message });
    }
};
