import { Router } from 'express';
import {
    sendInvitation,
    validateInvitation,
    acceptInvitation,
    declineInvitation,
    resendInvitation,
    revokeInvitation,
    listPendingInvitations
} from '../controllers/invitationController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public route - validate invitation token (no auth required)
router.get('/validate/:token', validateInvitation);

// Protected routes - require authentication
router.use(authenticate);

// Accept invitation (authenticated user)
router.post('/accept/:token', acceptInvitation);

// Decline invitation
router.post('/decline/:token', declineInvitation);

// Resend invitation (owner/admin only - checked in controller)
router.post('/resend/:id', resendInvitation);

// Revoke invitation (owner/admin only - checked in controller)
router.delete('/:id', revokeInvitation);

export default router;
