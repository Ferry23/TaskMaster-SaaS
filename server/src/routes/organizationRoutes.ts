import { Router } from 'express';
import {
    createOrganization,
    getMyOrganizations,
    getOrganizationById,
    updateOrganization,
    deleteOrganization
} from '../controllers/organizationController';
import { sendInvitation, listPendingInvitations } from '../controllers/invitationController';
import { authenticate } from '../middleware/auth';
import memberRoutes from './memberRoutes';

const router = Router();

// All organization routes require authentication
router.use(authenticate);

// Create new organization (workspace)
router.post('/', createOrganization);

// Get all organizations where user is a member
router.get('/', getMyOrganizations);

// Get specific organization details
router.get('/:id', getOrganizationById);

// Update organization (owner/admin only)
router.put('/:id', updateOrganization);

// Delete organization (owner only)
router.delete('/:id', deleteOrganization);

// Nested routes for members
// /organizations/:id/members/*
router.use('/:id/members', memberRoutes);

// Invitation routes specific to organization
// /organizations/:id/invitations
router.post('/:id/invitations', sendInvitation);
router.get('/:id/invitations', listPendingInvitations);

export default router;
