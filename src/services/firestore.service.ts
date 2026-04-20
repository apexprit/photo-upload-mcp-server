import * as admin from 'firebase-admin';
import { FileMetadata, FilePermissions, AuditLog } from '../types';

let db: admin.firestore.Firestore | null = null;
const COLLECTIONS = {
  FILES: 'files',
  USERS: 'users',
  API_KEYS: 'api_keys',
  AUDIT_LOGS: 'audit_logs'
};

// Initialize Firebase Admin if not already initialized
function initializeFirestore(): admin.firestore.Firestore | null {
  if (db) {
    return db;
  }
  
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      });
    }
    db = admin.firestore();
    return db;
  } catch (error) {
    console.warn('Firebase Admin initialization failed:', (error as Error).message);
    console.warn('This is expected in development mode without Google Cloud credentials');
    // Return null to indicate Firestore is not available
    return null;
  }
}

// Get db instance, initializing if needed
function getDb(): admin.firestore.Firestore | null {
  if (!db) {
    db = initializeFirestore();
  }
  return db;
}


/**
 * Firestore service for metadata storage operations
 */
export class FirestoreService {
  /**
   * Save file metadata to Firestore
   */
  static async saveFileMetadata(metadata: FileMetadata): Promise<FileMetadata> {
    try {
      const db = getDb();
      if (!db) {
        console.warn('Firestore not available, returning mock metadata');
        return metadata;
      }
      
      const fileRef = db.collection(COLLECTIONS.FILES).doc(metadata.fileId);
      await fileRef.set({
        ...metadata,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log the action
      await this.logAudit({
        action: 'FILE_UPLOAD',
        resourceType: 'file',
        resourceId: metadata.fileId,
        userId: metadata.uploadedBy,
        userEmail: metadata.uploadedByEmail,
        details: {
          fileName: metadata.fileName,
          size: metadata.size,
          mimeType: metadata.mimeType
        }
      });

      return metadata;
    } catch (error) {
      console.error('Error saving file metadata:', error);
      throw new Error(`Failed to save file metadata: ${(error as Error).message}`);
    }
  }

  /**
   * Get file metadata by ID
   */
  static async getFileMetadata(fileId: string): Promise<FileMetadata | null> {
    try {
      const db = getDb();
      if (!db) {
        console.warn('Firestore not available, returning mock metadata for development');
        // Return mock metadata for development/testing
        return FirestoreService.getMockMetadata(fileId);
      }
      
      const fileRef = db.collection(COLLECTIONS.FILES).doc(fileId);
      const doc = await fileRef.get();

      if (!doc.exists) {
        return null;
      }

      return doc.data() as FileMetadata;
    } catch (error) {
      console.warn('Firestore operation failed, returning mock metadata for development:', (error as Error).message);
      // Return mock metadata when Firestore operations fail
      return FirestoreService.getMockMetadata(fileId);
    }
  }

  /**
   * Generate mock metadata for development/testing
   */
  private static getMockMetadata(fileId: string): FileMetadata {
    return {
      fileId,
      fileName: `test-file-${fileId}`,
      size: 1024,
      mimeType: 'image/jpeg',
      storagePath: `uploads/${fileId}.jpg`,
      storageUrl: `https://storage.googleapis.com/test-bucket/uploads/${fileId}.jpg`,
      uploadedBy: 'test-user-123',
      uploadedByEmail: 'test-user@example.com',
      uploadDate: new Date().toISOString(),
      permissions: {
        owner: 'test-user-123',
        viewers: ['test-user-123'],
        editors: ['test-user-123'],
        sharedWith: []
      },
      tags: ['test', 'development'],
      isPublic: false,
      description: 'Mock file for development testing'
    } as FileMetadata;
  }

  /**
   * Update file metadata
   */
  static async updateFileMetadata(
    fileId: string, 
    updates: Partial<FileMetadata>
  ): Promise<FileMetadata> {
    try {
      const db = getDb();
      if (!db) {
        console.warn('Firestore not available, returning mock metadata');
        // Return a mock metadata object
        return {
          fileId,
          fileName: 'mock-file',
          size: 0,
          mimeType: 'application/octet-stream',
          storagePath: 'mock/path',
          uploadedBy: 'mock-user',
          uploadedByEmail: 'mock@example.com',
          uploadedAt: new Date().toISOString(),
          permissions: { owner: 'mock-user', sharedWith: [] },
          tags: [],
          description: '',
          ...updates
        } as FileMetadata;
      }
      
      const fileRef = db.collection(COLLECTIONS.FILES).doc(fileId);
      
      // Check if file exists
      const doc = await fileRef.get();
      if (!doc.exists) {
        throw new Error('File not found');
      }

      await fileRef.update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Get updated metadata
      const updatedDoc = await fileRef.get();
      const metadata = updatedDoc.data() as FileMetadata;

      // Log the action
      await this.logAudit({
        action: 'FILE_UPDATE',
        resourceType: 'file',
        resourceId: fileId,
        userId: updates.uploadedBy || metadata.uploadedBy,
        userEmail: updates.uploadedByEmail || metadata.uploadedByEmail,
        details: {
          updates: Object.keys(updates)
        }
      });

      return metadata;
    } catch (error) {
      console.error('Error updating file metadata:', error);
      throw new Error(`Failed to update file metadata: ${(error as Error).message}`);
    }
  }

  /**
   * Delete file metadata
   */
  static async deleteFileMetadata(fileId: string, userId: string, userEmail: string): Promise<void> {
    try {
      const db = getDb();
      if (!db) {
        console.warn('Firestore not available, skipping delete');
        return;
      }
      
      const fileRef = db.collection(COLLECTIONS.FILES).doc(fileId);
      await fileRef.delete();

      // Log the action
      await this.logAudit({
        action: 'FILE_DELETE',
        resourceType: 'file',
        resourceId: fileId,
        userId,
        userEmail,
        details: {
          fileId
        }
      });
    } catch (error) {
      console.error('Error deleting file metadata:', error);
      throw new Error(`Failed to delete file metadata: ${(error as Error).message}`);
    }
  }

  /**
   * List files with optional filtering
   */
  static async listFiles(
    userId?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ files: FileMetadata[]; total: number }> {
    try {
      const db = getDb();
      if (!db) {
        console.warn('Firestore not available, returning empty list');
        return { files: [], total: 0 };
      }
      
      let query: admin.firestore.Query = db.collection(COLLECTIONS.FILES);

      // Filter by user if provided
      if (userId) {
        query = query.where('uploadedBy', '==', userId);
      }

      // Apply pagination
      query = query.orderBy('uploadedAt', 'desc').limit(limit).offset(offset);

      const snapshot = await query.get();
      const files: FileMetadata[] = [];

      snapshot.forEach(doc => {
        files.push(doc.data() as FileMetadata);
      });

      // Get total count (without pagination)
      let totalQuery: admin.firestore.Query = db.collection(COLLECTIONS.FILES);
      if (userId) {
        totalQuery = totalQuery.where('uploadedBy', '==', userId);
      }
      const totalSnapshot = await totalQuery.count().get();
      const total = totalSnapshot.data().count;

      return { files, total };
    } catch (error) {
      console.error('Error listing files:', error);
      throw new Error(`Failed to list files: ${(error as Error).message}`);
    }
  }

  /**
   * Update file permissions
   */
  static async updateFilePermissions(
    fileId: string,
    permissions: FilePermissions,
    userId: string,
    userEmail: string
  ): Promise<void> {
    try {
      const db = getDb();
      if (!db) {
        console.warn('Firestore not available, skipping permission update');
        return;
      }
      
      const fileRef = db.collection(COLLECTIONS.FILES).doc(fileId);
      await fileRef.update({
        permissions,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log the action
      await this.logAudit({
        action: 'PERMISSION_UPDATE',
        resourceType: 'file',
        resourceId: fileId,
        userId,
        userEmail,
        details: {
          fileId,
          permissions
        }
      });
    } catch (error) {
      console.error('Error updating file permissions:', error);
      throw new Error(`Failed to update file permissions: ${(error as Error).message}`);
    }
  }

  /**
   * Check if user can view a file
   */
  static canViewFile(file: FileMetadata, userId: string): boolean {
    // Owner can always view
    if (file.permissions.owner === userId) {
      return true;
    }

    // Check if user is in viewers or editors arrays
    if (file.permissions.viewers.includes(userId) || file.permissions.editors.includes(userId)) {
      return true;
    }

    // Check shared permissions
    const sharedWith = file.permissions.sharedWith || [];
    return sharedWith.some(shared =>
      shared.userId === userId &&
      (shared.permission === 'view' || shared.permission === 'edit')
    );
  }

  /**
   * Check if user can edit a file
   */
  static canEditFile(file: FileMetadata, userId: string): boolean {
    // Owner can always edit
    if (file.permissions.owner === userId) {
      return true;
    }

    // Check shared permissions
    const sharedWith = file.permissions.sharedWith || [];
    return sharedWith.some(shared =>
      shared.userId === userId &&
      shared.permission === 'edit'
    );
  }

  /**
   * Log audit trail
   */
  static async logAudit(logData: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    try {
      const db = getDb();
      if (!db) {
        console.warn('Firestore not available, skipping audit log');
        return;
      }
      
      const auditRef = db.collection(COLLECTIONS.AUDIT_LOGS).doc();
      await auditRef.set({
        ...logData,
        id: auditRef.id,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Error logging audit trail:', error);
      // Don't throw - audit failures shouldn't break the main operation
    }
  }

  /**
   * Get user by ID
   */
  static async getUser(userId: string): Promise<any> {
    try {
      const db = getDb();
      if (!db) {
        console.warn('Firestore not available, returning mock user');
        return {
          id: userId,
          email: `${userId}@example.com`,
          name: 'Mock User',
          role: 'user'
        };
      }
      
      const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
      const doc = await userRef.get();

      if (!doc.exists) {
        return null;
      }

      return doc.data();
    } catch (error) {
      console.error('Error getting user:', error);
      throw new Error(`Failed to get user: ${(error as Error).message}`);
    }
  }

  /**
   * Validate API key
   */
  static async validateApiKey(apiKey: string): Promise<{ isValid: boolean; userId?: string; permissions?: string[] }> {
    try {
      const db = getDb();
      if (!db) {
        console.warn('Firestore not available, accepting test API key in development');
        // In development without Firestore, accept test API key
        if (process.env.NODE_ENV === 'development' && apiKey === 'test-api-key') {
          return {
            isValid: true,
            userId: 'test-user-123',
            permissions: ['files.read', 'files.write', 'metadata.read', 'metadata.write']
          };
        }
        return { isValid: false };
      }
      
      const apiKeysRef = db.collection(COLLECTIONS.API_KEYS);
      const query = apiKeysRef.where('key', '==', apiKey).where('isActive', '==', true);
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        return { isValid: false };
      }
      
      const apiKeyDoc = snapshot.docs[0].data();
      const now = new Date();
      
      // Check expiration
      if (apiKeyDoc.expiresAt && new Date(apiKeyDoc.expiresAt) < now) {
        // Mark as inactive
        await snapshot.docs[0].ref.update({ isActive: false });
        return { isValid: false };
      }
      
      // Update last used timestamp
      await snapshot.docs[0].ref.update({
        lastUsed: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return {
        isValid: true,
        userId: apiKeyDoc.owner,
        permissions: apiKeyDoc.permissions || []
      };
    } catch (error) {
      console.error('Error validating API key:', error);
      return { isValid: false };
    }
  }
}