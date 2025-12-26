import { Router } from 'express';
import {
    getOrganizationMembers,
    updateMemberRole,
    removeMember,
    leaveOrganization
} from '../controllers/memberController';
import { authenticate } from '../middleware/auth';

const router = Router({ mergeParams: true }); // mergeParams untuk akses :id dari parent router

// All member routes require authentication
router.use(authenticate);

// Get all members in organization
router.get('/', getOrganizationMembers);

// Update member role (owner/admin only)
router.put('/:userId', updateMemberRole);

// Remove member from organization (owner/admin only)
router.delete('/:userId', removeMember);

// Leave organization (member voluntarily leaves)
router.post('/leave', leaveOrganization);

export default router;
