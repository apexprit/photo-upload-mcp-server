import { PermissionLevel } from '../types';

/**
 * Permission service for validating user permissions
 */
export class PermissionService {
  /**
   * Validate if user has upload permission
   */
  static async validateUploadPermission(
    userId: string, 
    requiredLevel: PermissionLevel = PermissionLevel.WRITE
  ): Promise<boolean> {
    try {
      // In a real implementation, this would check:
      // 1. User's role in the system
      // 2. User's specific permissions
      // 3. Rate limits or quotas
      // 4. Any restrictions based on user status
      
      // For prototype purposes:
      // - All authenticated users can upload (WRITE level)
      // - Only admins can have ADMIN level
      
      if (requiredLevel === PermissionLevel.ADMIN) {
        // Check if user is admin
        const isAdmin = await this.isUserAdmin(userId);
        return isAdmin;
      }
      
      // For READ and WRITE levels, any authenticated user is allowed
      return userId !== 'anonymous';
    } catch (error) {
      console.error('Error validating upload permission:', error);
      return false;
    }
  }

  /**
   * Validate if user can access a specific resource
   */
  static async validateResourceAccess(
    userId: string,
    resourceId: string,
    resourceType: 'file' | 'folder' | 'project',
    requiredAction: 'read' | 'write' | 'delete'
  ): Promise<boolean> {
    try {
      // In a real implementation, this would:
      // 1. Fetch resource metadata
      // 2. Check resource permissions
      // 3. Validate user's access level
      
      // For prototype purposes, we'll implement basic checks
      switch (resourceType) {
        case 'file':
          return await this.validateFileAccess(userId, resourceId, requiredAction);
        default:
          // Default to allowing access for authenticated users
          return userId !== 'anonymous';
      }
    } catch (error) {
      console.error('Error validating resource access:', error);
      return false;
    }
  }

  /**
   * Validate file access
   */
  private static async validateFileAccess(
    userId: string,
    fileId: string,
    action: 'read' | 'write' | 'delete'
  ): Promise<boolean> {
    // This would typically check Firestore for file permissions
    // For now, return true for all authenticated users
    return userId !== 'anonymous';
  }

  /**
   * Check if user is an admin
   */
  private static async isUserAdmin(userId: string): Promise<boolean> {
    // In a real implementation, this would check Firestore or another user store
    // For prototype, we'll check for admin email pattern or hardcoded IDs
    const adminUserIds = ['admin', 'system'];
    return adminUserIds.includes(userId);
  }

  /**
   * Get user's permission level
   */
  static async getUserPermissionLevel(userId: string): Promise<PermissionLevel> {
    if (await this.isUserAdmin(userId)) {
      return PermissionLevel.ADMIN;
    }
    
    // Check if user has any special permissions
    const hasWriteAccess = await this.validateUploadPermission(userId, PermissionLevel.WRITE);
    
    if (hasWriteAccess) {
      return PermissionLevel.WRITE;
    }
    
    return PermissionLevel.READ;
  }

  /**
   * Validate API key permissions
   */
  static validateApiKeyPermissions(
    apiKeyPermissions: string[],
    requiredPermissions: string[]
  ): boolean {
    if (!apiKeyPermissions || apiKeyPermissions.length === 0) {
      return false;
    }
    
    // Check if all required permissions are present
    return requiredPermissions.every(permission => 
      apiKeyPermissions.includes(permission)
    );
  }

  /**
   * Get required permissions for an action
   */
  static getRequiredPermissions(action: string, resourceType?: string): string[] {
    const permissionsMap: Record<string, string[]> = {
      'file:upload': ['files.write', 'files.create'],
      'file:read': ['files.read'],
      'file:update': ['files.write'],
      'file:delete': ['files.delete'],
      'metadata:read': ['metadata.read'],
      'metadata:update': ['metadata.write'],
      'user:create': ['users.write'],
      'user:read': ['users.read'],
    };
    
    const key = resourceType ? `${resourceType}:${action}` : action;
    return permissionsMap[key] || [action];
  }
}

// Export convenience functions
export const validateUploadPermission = PermissionService.validateUploadPermission.bind(PermissionService);
export const validateResourceAccess = PermissionService.validateResourceAccess.bind(PermissionService);
export const getUserPermissionLevel = PermissionService.getUserPermissionLevel.bind(PermissionService);
export const validateApiKeyPermissions = PermissionService.validateApiKeyPermissions.bind(PermissionService);
export const getRequiredPermissions = PermissionService.getRequiredPermissions.bind(PermissionService);