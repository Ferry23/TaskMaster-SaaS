import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';

export const socketAuth = async (socket: any, next: (err?: any) => void) => {
    try {
        let token = socket.handshake.auth.token;

        // Fallback to cookie if no auth token provided
        if (!token && socket.handshake.headers.cookie) {
            // Parse cookies manually
            const cookieHeader = socket.handshake.headers.cookie;
            const cookies: any = {};
            cookieHeader.split(';').forEach((cookie: string) => {
                const [name, ...rest] = cookie.split('=');
                cookies[name.trim()] = rest.join('=').trim();
            });
            token = cookies.accessToken || cookies.access_token;
        }

        if (!token) {
            console.log('No token provided for socket connection');
            return next(new Error("Authentication error: No token provided"));
        }

        // Verify JWT token (not Firebase token)
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);

        if (!decoded) {
            return next(new Error("Authentication error: Invalid token"));
        }

        // Attach user info to socket
        socket.user = {
            uid: decoded.userId,
            email: decoded.email,
            role: decoded.role
        };

        next();
    } catch (error) {
        console.error("Socket authentication failed:", error);
        next(new Error("Authentication error"));
    }
};
