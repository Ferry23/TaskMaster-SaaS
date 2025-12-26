
// Types for Activity Log
export interface ActivityLog {
    id: string;
    organizationId: string;
    userId: string;
    userEmail: string; // Snapshot in case user is deleted
    action: 'TASK_CREATE' | 'TASK_UPDATE' | 'TASK_DELETE' | 'MEMBER_ADD' | 'MEMBER_REMOVE' | 'INVITATION_SEND' | 'MEMBER_LEAVE';
    entityId: string; // e.g., taskId
    entityType: 'TASK' | 'MEMBER' | 'INVITATION';
    metadata?: any; // e.g., task title, changes
    createdAt: string;
}

import { db } from '../config/firebase';
import { getIO } from '../socket';

export const logActivity = async (
    organizationId: string,
    userId: string,
    userEmail: string,
    action: ActivityLog['action'],
    entityType: ActivityLog['entityType'],
    entityId: string,
    metadata?: any
) => {
    try {
        const logRef = db.collection('activity_logs').doc();
        const logData: ActivityLog = {
            id: logRef.id,
            organizationId,
            userId,
            userEmail,
            action,
            entityType,
            entityId,
            metadata,
            createdAt: new Date().toISOString()
        };

        await logRef.set(logData);

        // Real-time broadcast
        getIO().to(organizationId).emit('activity:new', logData);

        return logData;
    } catch (error) {
        console.error('Failed to log activity:', error);
        // Don't throw, just log error so we don't block main flow
    }
};
