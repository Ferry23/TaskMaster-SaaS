import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet());
app.use(morgan('dev'));
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
}));

import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import taskRoutes from './routes/taskRoutes';
import organizationRoutes from './routes/organizationRoutes';
import invitationRoutes from './routes/invitationRoutes';

app.get('/', (req, res) => {
    res.send('API is running...');
});

import http from 'http';
import { socketAuth } from './middleware/socketAuth';
import { initSocket, getIO } from './socket';

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/tasks', taskRoutes);
app.use('/organizations', organizationRoutes);
app.use('/invitations', invitationRoutes);

const httpServer = http.createServer(app);
const io = initSocket(httpServer);


// Middleware
io.use(socketAuth);

// Connection Handler
io.on('connection', (socket: any) => {
    console.log(`User connected: ${socket.user?.email} (${socket.id})`);

    // Join Personal Room (for direct notifications)
    if (socket.user?.uid) {
        socket.join(socket.user.uid);
    }

    // Helper to broadcast active users
    const broadcastWorkspaceUsers = async (workspaceId: string) => {
        if (!workspaceId) return;
        const sockets = await io.in(workspaceId).fetchSockets();
        const users = sockets.map((s: any) => ({
            userId: s.user.uid,
            email: s.user.email,
            // Add name/avatar if available in socket.user, or fetch from DB (expensive)
            // Ideally socket.user should have minimal needed info
        }));

        // Deduplicate users (if same user has multiple tabs)
        const uniqueUsers = Array.from(new Map(users.map(u => [u.userId, u])).values());

        io.to(workspaceId).emit('workspace:users', uniqueUsers);
    };

    // Join Workspace Room
    socket.on('join_workspace', async (workspaceId: string) => {
        if (workspaceId) {
            socket.join(workspaceId);
            // Store workspaceId on socket for disconnect handling
            socket.workspaceId = workspaceId;
            console.log(`User ${socket.user?.email} joined workspace: ${workspaceId}`);

            await broadcastWorkspaceUsers(workspaceId);
        }
    });

    // Leave Workspace Room
    socket.on('leave_workspace', async (workspaceId: string) => {
        if (workspaceId) {
            socket.leave(workspaceId);
            delete socket.workspaceId; // Remove tracking
            await broadcastWorkspaceUsers(workspaceId);
        }
    });

    socket.on('disconnect', async () => {
        console.log('User disconnected');
        if (socket.workspaceId) {
            await broadcastWorkspaceUsers(socket.workspaceId);
        }
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

