import { Router } from 'express';
import { registerFirestore, loginFirestore, logout, refresh } from '../controllers/authController';

const router = Router();

router.post('/register', registerFirestore);
router.post('/login', loginFirestore);
router.post('/logout', logout);
router.post('/refresh', refresh);

export default router;
