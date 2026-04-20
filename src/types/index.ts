export interface FileMetadata {
  fileId: string;
  fileName: string;
  storagePath: string;
  storageUrl: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedByEmail: string;
  uploadDate: string;
  lastModified?: string;
  permissions: FilePermissions;
  tags: string[];
  isPublic: boolean;
  customMetadata?: Record<string, any>;
}

export interface FilePermissions {
  owner: string;
  viewers: string[];
  editors: string[];
  sharedWith?: SharedPermission[];
}

export interface SharedPermission {
  userId: string;
  userEmail: string;
  permission: 'view' | 'edit';
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
}

export interface User {
  id: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'user' | 'guest';
  createdAt: string;
  lastLogin?: string;
}

export interface ApiKey {
  key: string;
  name: string;
  owner: string;
  permissions: string[];
  createdAt: string;
  expiresAt?: string;
  lastUsed?: string;
  isActive: boolean;
}

export interface AuditLog {
  id: string;
  action: string;
  resourceType: 'file' | 'user' | 'permission';
  resourceId: string;
  userId: string;
  userEmail: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

export enum PermissionLevel {
  READ = 'read',
  WRITE = 'write',
  ADMIN = 'admin'
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
}

// Express request extension
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      apiKey?: string;
    }
  }
}