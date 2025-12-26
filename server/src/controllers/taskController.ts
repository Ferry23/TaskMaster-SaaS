import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { z } from 'zod';

interface AuthRequest extends Request {
    user?: any;
}

const taskSchema = z.object({
    title: z.string().min(1),
    description: z.string(),
    status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    // Team collaboration fields (optional - null means personal task)
    organizationId: z.string().optional(), // null = personal task
    assignedTo: z.string().optional(), // userId yang di-assign
    visibility: z.enum(['private', 'team']).optional().default('private'),
});

export const getTasks = async (req: AuthRequest, res: Response) => {
    try {
        const { status } = req.query;
        const userId = req.user.userId;

        // Get user's organizations
        const membershipsSnapshot = await db.collection('organization_members')
            .where('userId', '==', userId)
            .get();

        const organizationIds = membershipsSnapshot.docs.map(doc => doc.data().organizationId);

        // Fetch personal tasks
        let personalQuery = db.collection('tasks')
            .where('userId', '==', userId)
            .where('organizationId', '==', null);

        if (status) {
            personalQuery = personalQuery.where('status', '==', status);
        }

        const personalSnapshot = await personalQuery.get();
        const personalTasks = personalSnapshot.docs.map(doc => doc.data());

        // Fetch team tasks from all user's workspaces
        let teamTasks: any[] = [];

        if (organizationIds.length > 0) {
            // Firestore 'in' query limit is 10, so batch if needed
            for (const orgId of organizationIds) {
                let teamQuery = db.collection('tasks')
                    .where('organizationId', '==', orgId);

                if (status) {
                    teamQuery = teamQuery.where('status', '==', status);
                }

                const teamSnapshot = await teamQuery.get();
                teamTasks.push(...teamSnapshot.docs.map(doc => doc.data()));
            }
        }

        const allTasks = [...personalTasks, ...teamTasks];

        console.log(`getTasks: User ${userId} - Personal: ${personalTasks.length}, Team: ${teamTasks.length}`);

        res.json({ tasks: allTasks, total: allTasks.length, totalPages: 1 });
    } catch (error) {
        console.error('getTasks error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

import { getIO } from '../socket';
import { logActivity } from '../services/activityLogService';

export const createTask = async (req: AuthRequest, res: Response) => {
    try {
        const { title, description, status, priority, organizationId, assignedTo, visibility } = taskSchema.parse(req.body);

        // Permission Check: Only OWNER/ADMIN can create team tasks
        if (organizationId) {
            const memberDoc = await db.collection('organization_members')
                .where('organizationId', '==', organizationId)
                .where('userId', '==', req.user.userId)
                .limit(1)
                .get();

            if (memberDoc.empty) {
                return res.status(403).json({ message: 'You are not a member of this organization' });
            }

            const memberData = memberDoc.docs[0].data();
            if (memberData.role === 'MEMBER') {
                return res.status(403).json({ message: 'Only OWNER and ADMIN can create tasks' });
            }
        }

        const newTaskRef = db.collection('tasks').doc();
        const taskData = {
            id: newTaskRef.id,
            title,
            description,
            status: status || 'TODO',
            priority: priority || 'MEDIUM',
            userId: req.user.userId, // Owner/creator
            createdBy: req.user.userId, // Siapa yang buat task ini
            // Team fields (optional)
            organizationId: organizationId || null,
            assignedTo: assignedTo || null,
            visibility: visibility || 'private',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await newTaskRef.set(taskData);

        // Real-time Update & Activity Log
        if (organizationId) {
            // Emit to workspace room with correct format
            getIO().to(`room:workspace:${organizationId}`).emit('task:created', taskData);
            console.log(`Socket: Emitted task:created to room:workspace:${organizationId}`);

            // Log Activity
            logActivity(
                organizationId,
                req.user.userId,
                req.user.email || 'Unknown',
                'TASK_CREATE',
                'TASK',
                taskData.id,
                { title: taskData.title }
            );

            // Notify Assignee
            if (assignedTo && assignedTo !== req.user.userId) {
                getIO().to(assignedTo).emit('notification:assign', {
                    message: `You were assigned to task: ${title}`,
                    taskId: taskData.id,
                    by: req.user.email
                });
            }
        }

        res.status(201).json(taskData);
    } catch (error: any) {
        res.status(400).json({ message: error.errors || error.message });
    }

};

export const updateTask = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { title, description, status, priority } = req.body;

        const taskRef = db.collection('tasks').doc(id);
        const doc = await taskRef.get();

        if (!doc.exists) return res.status(404).json({ message: 'Task not found' });

        const task = doc.data();
        if (task?.userId !== req.user.userId) return res.status(403).json({ message: 'Forbidden' });

        await taskRef.update({
            title,
            description,
            status,
            priority,
            updatedAt: new Date().toISOString()
        });

        const updatedDoc = await taskRef.get();
        const updatedTask = updatedDoc.data();

        // Real-time Update
        if (updatedTask?.organizationId) {
            getIO().to(`room:workspace:${updatedTask.organizationId}`).emit('task:updated', updatedTask);
            console.log(`Socket: Emitted task:updated to room:workspace:${updatedTask.organizationId}`);

            logActivity(
                updatedTask.organizationId,
                req.user.userId,
                req.user.email || 'Unknown',
                'TASK_UPDATE',
                'TASK',
                updatedTask.id,
                { title: updatedTask.title }
            );
        }

        res.json(updatedTask);
    } catch (error) {
        console.error("Update task error:", error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const taskRef = db.collection('tasks').doc(id);
        const doc = await taskRef.get();

        if (!doc.exists) return res.status(404).json({ message: 'Task not found' });

        const task = doc.data();
        if (task?.userId !== req.user.userId) return res.status(403).json({ message: 'Forbidden' });

        await taskRef.delete();

        // Real-time Update
        if (task?.organizationId) {
            getIO().to(`room:workspace:${task.organizationId}`).emit('task:deleted', { taskId: id });
            console.log(`Socket: Emitted task:deleted to room:workspace:${task.organizationId}`);

            logActivity(
                task.organizationId,
                req.user.userId,
                req.user.email || 'Unknown',
                'TASK_DELETE',
                'TASK',
                id,
                { title: task.title }
            );
        }

        res.json({ message: 'Task deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
