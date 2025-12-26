import { z } from 'zod';

// ==================== MEMBER SCHEMA ====================

export const memberRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);
export const memberStatusSchema = z.enum(['active', 'inactive']);

export const addMemberSchema = z.object({
    userId: z.string(),
    email: z.string().email(),
    role: memberRoleSchema.exclude(['OWNER']), // OWNER tidak bisa di-assign manual
});

export const updateMemberRoleSchema = z.object({
    role: memberRoleSchema.exclude(['OWNER']), // OWNER tidak bisa diubah
});

// ==================== TYPES ====================

export type MemberRole = z.infer<typeof memberRoleSchema>;
export type MemberStatus = z.infer<typeof memberStatusSchema>;

export interface OrganizationMember {
    id: string;
    organizationId: string;
    userId: string;
    email: string;
    role: MemberRole;
    status: MemberStatus;
    invitedBy: string;
    joinedAt: string;
}

export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

// ==================== PERMISSIONS ====================

export const PERMISSIONS = {
    OWNER: [
        'organization:delete',
        'organization:update',
        'members:invite',
        'members:remove',
        'members:update_role',
        'tasks:create',
        'tasks:update_any',
        'tasks:delete_any',
    ],
    ADMIN: [
        'organization:update',
        'members:invite',
        'members:remove',
        'members:update_role',
        'tasks:create',
        'tasks:update_any',
        'tasks:delete_any',
    ],
    MEMBER: [
        'tasks:create',
        'tasks:update_own',
        'tasks:delete_own',
    ],
    VIEWER: [
        'tasks:view',
    ],
} as const;

export function hasPermission(role: MemberRole, permission: string): boolean {
    const rolePermissions = PERMISSIONS[role];
    if (!rolePermissions) return false;
    return rolePermissions.some(p => p === permission);
}
