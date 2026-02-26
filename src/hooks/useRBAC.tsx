/**
 * ROLE-BASED ACCESS CONTROL (RBAC) HOOKS
 *
 * Provides fine-grained permission checks for UI element visibility
 * based on the authenticated user's role within the current clinic.
 *
 * Roles:
 *   - admin:        Full access (settings, billing, AI config, team management)
 *   - receptionist:  Operational access (conversations, patients, calendar)
 *
 * Usage:
 *   const { canAccess } = useRBAC();
 *   if (canAccess('settings')) { ... }
 *
 *   <RBACGuard requiredPermission="campaigns.launch">
 *     <Button>Launch Campaign</Button>
 *   </RBACGuard>
 */

import React from 'react';
import { useClinic } from '@/contexts/ClinicContext';

// ─── Permission Definitions ────────────────────────────────

export type Permission =
    | 'dashboard.view'
    | 'conversations.view'
    | 'conversations.takeover'
    | 'patients.view'
    | 'patients.edit'
    | 'patients.delete'
    | 'appointments.view'
    | 'appointments.edit'
    | 'campaigns.view'
    | 'campaigns.launch'
    | 'agents.view'
    | 'agents.configure'
    | 'integrations.view'
    | 'integrations.manage'
    | 'settings.view'
    | 'settings.edit'
    | 'settings.billing';

type Role = 'admin' | 'receptionist';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    admin: [
        'dashboard.view',
        'conversations.view',
        'conversations.takeover',
        'patients.view',
        'patients.edit',
        'patients.delete',
        'appointments.view',
        'appointments.edit',
        'campaigns.view',
        'campaigns.launch',
        'agents.view',
        'agents.configure',
        'integrations.view',
        'integrations.manage',
        'settings.view',
        'settings.edit',
        'settings.billing',
    ],
    receptionist: [
        'dashboard.view',
        'conversations.view',
        'conversations.takeover',
        'patients.view',
        'patients.edit',
        'appointments.view',
        'appointments.edit',
        'campaigns.view',
        // Receptionists can view but NOT launch campaigns or configure AI
    ],
};

// ─── Hook ───────────────────────────────────────────────────

export function useRBAC() {
    const { memberships, currentClinic, isAdmin } = useClinic();

    const currentRole: Role = isAdmin ? 'admin' : 'receptionist';
    const permissions = ROLE_PERMISSIONS[currentRole];

    const canAccess = (permission: Permission): boolean => {
        return permissions.includes(permission);
    };

    const canAccessAny = (...perms: Permission[]): boolean => {
        return perms.some(p => permissions.includes(p));
    };

    const canAccessAll = (...perms: Permission[]): boolean => {
        return perms.every(p => permissions.includes(p));
    };

    return {
        role: currentRole,
        permissions,
        canAccess,
        canAccessAny,
        canAccessAll,
        isAdmin,
    };
}

// ─── Guard Component ────────────────────────────────────────

interface RBACGuardProps {
    requiredPermission: Permission;
    fallback?: React.ReactNode;
    children: React.ReactNode;
}

/**
 * Conditionally renders children only if the user has the required permission.
 *
 * Example:
 *   <RBACGuard requiredPermission="campaigns.launch">
 *     <Button onClick={launchCampaign}>Launch</Button>
 *   </RBACGuard>
 */
export function RBACGuard({ requiredPermission, fallback = null, children }: RBACGuardProps) {
    const { canAccess } = useRBAC();

    if (!canAccess(requiredPermission)) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}
