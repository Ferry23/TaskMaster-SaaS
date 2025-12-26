import { Request, Response } from 'express';
import { db } from '../config/firebase';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

interface AuthRequest extends Request {
    user?: any;
}

export const getMe = async (req: AuthRequest, res: Response) => {
    try {
        const userDoc = await db.collection('users').doc(req.user.userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = userDoc.data();
        if (user) {
            delete user.password;
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const snapshot = await db.collection('users').get();
        const users = snapshot.docs.map(doc => {
            const userData = doc.data();
            delete userData.password;
            return userData;
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const updateProfileSchema = z.object({
    name: z.string().min(2).optional(),
});

export const updateProfile = async (req: AuthRequest, res: Response) => {
    try {
        const { name } = updateProfileSchema.parse(req.body);
        const userId = req.user.userId;

        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({ message: 'User not found' });
        }

        await userRef.update({
            name,
            updatedAt: new Date().toISOString()
        });

        const updatedDoc = await userRef.get();
        const userData = updatedDoc.data();
        if (userData) {
            delete userData.password;
        }

        res.json({ message: 'Profile updated successfully', user: userData });
    } catch (error: any) {
        res.status(400).json({ message: error.errors || error.message });
    }
};

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export const changePassword = async (req: AuthRequest, res: Response) => {
    try {
        const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
        const userId = req.user.userId;

        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = userDoc.data();

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user?.password || '');
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await userRef.update({
            password: hashedPassword,
            updatedAt: new Date().toISOString()
        });

        res.json({ message: 'Password changed successfully' });
    } catch (error: any) {
        res.status(400).json({ message: error.errors || error.message });
    }
};
