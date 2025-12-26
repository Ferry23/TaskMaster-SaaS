import { z } from 'zod';

// ==================== ORGANIZATION SCHEMA ====================

export const organizationSchema = z.object({
    name: z.string().min(2, 'Workspace name must be at least 2 characters').max(100),
    plan: z.enum(['free', 'pro', 'business', 'enterprise']).default('free'),
    maxMembers: z.number().int().positive().default(5),
});

export const updateOrganizationSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    plan: z.enum(['free', 'pro', 'business', 'enterprise']).optional(),
    maxMembers: z.number().int().positive().optional(),
});

// ==================== TYPES ====================

export interface Organization {
    id: string;
    name: string;
    ownerId: string;
    plan: 'free' | 'pro' | 'business' | 'enterprise';
    maxMembers: number;
    createdAt: string;
    updatedAt: string;
}

export type CreateOrganizationInput = z.infer<typeof organizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
