import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../config/firebase'; // Ensure this matches your file path!
import { z } from 'zod';

const registerSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
});

const generateTokens = (userId: string, role: string, email: string) => {
    const accessToken = jwt.sign({ userId, role, email }, process.env.JWT_SECRET as string, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId, role, email }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '7d' });
    return { accessToken, refreshToken };
};

export const registerFirestore = async (req: Request, res: Response) => {
    try {
        const { name, email, password } = registerSchema.parse(req.body);

        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', email).get();

        if (!snapshot.empty) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUserRef = usersRef.doc();
        await newUserRef.set({
            id: newUserRef.id,
            name,
            email,
            password: hashedPassword,
            role: 'USER',
            createdAt: new Date().toISOString(),
        });

        res.status(201).json({ message: 'User registered successfully', userId: newUserRef.id });
    } catch (error: any) {
        console.error("Register Error Detailed:", error);
        res.status(400).json({ message: error.errors || error.message });
    }
};

export const loginFirestore = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        console.log('🔐 Login attempt for:', email);

        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', email).get();

        if (snapshot.empty) {
            console.log('❌ User not found:', email);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = snapshot.docs[0].data();
        console.log('✅ User found:', user.id, user.email);

        const passwordMatch = await bcrypt.compare(password, user.password);
        console.log('🔑 Password match:', passwordMatch);

        if (!passwordMatch) {
            console.log('❌ Password mismatch for:', email);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const { accessToken, refreshToken } = generateTokens(user.id, user.role, user.email);
        console.log('🎫 Tokens generated for:', user.email);

        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 15 * 60 * 1000,
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        console.log('✅ Login successful for:', user.email);
        res.json({ message: 'Logged in successfully', user: { id: user.id, name: user.name, role: user.role } });
    } catch (error: any) {
        console.error('❌ Login error:', error);
        res.status(500).json({ message: error.message });
    }
}

export const logout = (req: Request, res: Response) => {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
};

export const refresh = (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });

    try {
        const decoded: any = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string);
        const { accessToken } = generateTokens(decoded.userId, decoded.role, decoded.email);

        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 15 * 60 * 1000,
        });

        res.json({ message: 'Refreshed access token' });
    } catch (e) {
        res.status(401).json({ message: 'Invalid refresh token' });
    }
};
