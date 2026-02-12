import type { User } from "@shared/schema.js";

// Role hierarchy for permission validation
export const ROLE_HIERARCHY = {
  viewer: 1,
  editor: 2,
  admin: 3,
  super_admin: 4
} as const;

export type Permission = 
  | 'read_campaigns'
  | 'create_campaigns'
  | 'edit_campaigns'
  | 'delete_campaigns'
  | 'copy_utm_links'
  | 'manage_templates'
  | 'manage_tags'
  | 'invite_users'
  | 'manage_users'
  | 'change_user_roles'
  | 'delete_users'
  | 'manage_account_settings'
  | 'manage_billing'
  | 'view_account_analytics';

// Role Permission Matrix - Implements exact requirements from user specification
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  viewer: [
    'read_campaigns',
    'copy_utm_links'
  ],
  editor: [
    'read_campaigns',
    'create_campaigns',
    'edit_campaigns', // Can edit their own campaigns only
    'copy_utm_links',
    'manage_templates', // Limited to their own templates
    'manage_tags'
  ],
  admin: [
    'read_campaigns',
    'create_campaigns',
    'edit_campaigns', // Can edit all campaigns
    'delete_campaigns', // Can delete all campaigns
    'copy_utm_links',
    'manage_templates',
    'manage_tags',
    'invite_users',
    'manage_users', // Cannot change Super Admin
    'change_user_roles' // Cannot change Super Admin
  ],
  super_admin: [
    'read_campaigns',
    'create_campaigns',
    'edit_campaigns',
    'delete_campaigns',
    'copy_utm_links',
    'manage_templates',
    'manage_tags',
    'invite_users',
    'manage_users',
    'change_user_roles',
    'delete_users',
    'manage_account_settings',
    'manage_billing',
    'view_account_analytics'
  ]
};

/**
 * Check if user has specific permission
 */
export function hasPermission(user: User, permission: Permission): boolean {
  const userPermissions = ROLE_PERMISSIONS[user.role] || [];
  return userPermissions.includes(permission);
}

/**
 * Check if user can perform action on target user (for user management)
 */
export function canManageUser(currentUser: User, targetUser: User): boolean {
  // Users can't manage themselves for role changes
  if (currentUser.id === targetUser.id) {
    return false;
  }
  
  // Only admins and super_admins can manage users
  if (!hasPermission(currentUser, 'manage_users')) {
    return false;
  }
  
  // Super Admin can manage everyone
  if (currentUser.role === 'super_admin') {
    return true;
  }
  
  // Admin cannot manage Super Admin
  if (currentUser.role === 'admin' && targetUser.role === 'super_admin') {
    return false;
  }
  
  return true;
}

/**
 * Check if user can change target user's role to new role
 */
export function canChangeUserRole(currentUser: User, targetUser: User, newRole: string): boolean {
  // Can't change your own role
  if (currentUser.id === targetUser.id) {
    return false;
  }
  
  // Only super_admin and admin can change roles
  if (!hasPermission(currentUser, 'change_user_roles')) {
    return false;
  }
  
  // Super Admin can change anyone to any role
  if (currentUser.role === 'super_admin') {
    return true;
  }
  
  // Admin cannot change Super Admin or promote to Super Admin
  if (currentUser.role === 'admin') {
    if (targetUser.role === 'super_admin' || newRole === 'super_admin') {
      return false;
    }
    return true;
  }
  
  return false;
}

/**
 * Check if user can edit/delete specific campaign
 */
export function canModifyCampaign(user: User, campaignOwnerId: number): boolean {
  // Super Admin and Admin can modify all campaigns
  if (user.role === 'super_admin' || user.role === 'admin') {
    return true;
  }
  
  // Editor can only modify their own campaigns
  if (user.role === 'editor') {
    return user.id === campaignOwnerId;
  }
  
  // Viewer cannot modify campaigns
  return false;
}

/**
 * Validate that user belongs to the specified account
 */
export function validateAccountAccess(user: User, requiredAccountId: number): boolean {
  return user.accountId === requiredAccountId;
}

/**
 * Permission middleware factory
 */
export function requirePermission(permission: Permission) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({ 
        message: `Insufficient permissions. Required: ${permission}`,
        userRole: req.user.role,
        requiredPermission: permission
      });
    }
    
    next();
  };
}

/**
 * Account validation middleware
 */
export function requireAccountAccess(accountIdField: string = 'accountId') {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const requiredAccountId = req.params[accountIdField] || req.body[accountIdField];
    
    if (!requiredAccountId) {
      return res.status(400).json({ message: `Missing ${accountIdField} parameter` });
    }
    
    if (!validateAccountAccess(req.user, parseInt(requiredAccountId))) {
      return res.status(403).json({ 
        message: "Access denied. User does not belong to this account.",
        userAccountId: req.user.accountId,
        requestedAccountId: requiredAccountId
      });
    }
    
    next();
  };
}

/**
 * Combined auth + permission + account validation middleware
 */
export function requirePermissionAndAccount(permission: Permission, accountIdField: string = 'accountId') {
  return [
    requirePermission(permission),
    requireAccountAccess(accountIdField)
  ];
}