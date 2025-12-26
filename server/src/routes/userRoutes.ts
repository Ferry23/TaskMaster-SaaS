import { Router } from 'express';
import { getMe, getAllUsers, updateProfile, changePassword } from '../controllers/userController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateProfile);
router.put('/me/password', authenticate, changePassword);
router.get('/', authenticate, authorize(['ADMIN']), getAllUsers);

export default router;
