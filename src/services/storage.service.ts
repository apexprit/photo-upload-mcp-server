import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

// Initialize Google Cloud Storage
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
});

const bucketName = process.env.CLOUD_STORAGE_BUCKET_NAME;
if (!bucketName) {
  console.warn('CLOUD_STORAGE_BUCKET_NAME environment variable is not set');
}

const bucket = bucketName ? storage.bucket(bucketName) : null;

/**
 * Storage service for Google Cloud Storage operations
 */
export class StorageService {
  /**
   * Upload a file to Cloud Storage
   */
  static async uploadFileToStorage(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    userId: string
  ): Promise<string> {
    if (!bucket) {
      throw new Error('Cloud Storage bucket not configured');
    }

    try {
      // Generate a unique file path
      const filePath = `uploads/${userId}/${Date.now()}-${fileName}`;
      const file = bucket.file(filePath);

      // Upload the file
      await file.save(buffer, {
        metadata: {
          contentType: mimeType,
          metadata: {
            uploadedBy: userId,
            originalName: fileName,
            uploadDate: new Date().toISOString()
          }
        },
        public: false, // Files are private by default
        validation: 'md5'
      });

      // Generate a signed URL for temporary access
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return signedUrl;
    } catch (error: unknown) {
      console.error('Error uploading file to storage:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to upload file: ${errorMessage}`);
    }
  }

  /**
   * Generate a presigned URL for direct upload
   */
  static async generatePresignedUrl(
    fileName: string,
    contentType: string,
    userId: string
  ): Promise<string> {
    if (!bucket) {
      throw new Error('Cloud Storage bucket not configured');
    }

    try {
      const filePath = `uploads/${userId}/${uuidv4()}-${fileName}`;
      const file = bucket.file(filePath);

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        contentType,
      });

      return url;
    } catch (error: unknown) {
      console.error('Error generating presigned URL:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to generate presigned URL: ${errorMessage}`);
    }
  }

  /**
   * Get file metadata from Cloud Storage
   */
  static async getFileMetadata(storagePath: string) {
    if (!bucket) {
      throw new Error('Cloud Storage bucket not configured');
    }

    try {
      const file = bucket.file(storagePath);
      const [metadata] = await file.getMetadata();
      return metadata;
    } catch (error: unknown) {
      console.error('Error getting file metadata from storage:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get file metadata: ${errorMessage}`);
    }
  }

  /**
   * Delete file from Cloud Storage
   */
  static async deleteFile(storagePath: string): Promise<void> {
    if (!bucket) {
      throw new Error('Cloud Storage bucket not configured');
    }

    try {
      const file = bucket.file(storagePath);
      await file.delete();
    } catch (error: unknown) {
      console.error('Error deleting file from storage:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to delete file: ${errorMessage}`);
    }
  }

  /**
   * Generate a download URL for a file
   */
  static async generateDownloadUrl(
    storagePath: string,
    expiresInMinutes: number = 60
  ): Promise<string> {
    if (!bucket) {
      throw new Error('Cloud Storage bucket not configured');
    }

    try {
      const file = bucket.file(storagePath);
      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresInMinutes * 60 * 1000,
      });

      return url;
    } catch (error: unknown) {
      console.error('Error generating download URL:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to generate download URL: ${errorMessage}`);
    }
  }

  /**
   * Validate file type
   */
  static validateFileType(mimeType: string): boolean {
    const allowedTypes = [
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      // Archives
      'application/zip',
      'application/x-rar-compressed',
      'application/x-tar',
      'application/gzip',
    ];

    return allowedTypes.includes(mimeType);
  }

  /**
   * Validate file size
   */
  static validateFileSize(size: number): boolean {
    const maxSize = 10 * 1024 * 1024; // 10MB
    return size <= maxSize;
  }

  /**
   * Get file extension from filename
   */
  static getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  /**
   * Get MIME type from filename
   */
  static getMimeTypeFromFilename(filename: string): string {
    const extension = this.getFileExtension(filename);
    
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'txt': 'text/plain',
      'csv': 'text/csv',
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
      'tar': 'application/x-tar',
      'gz': 'application/gzip',
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }
}

// Export convenience functions
export const uploadFileToStorage = StorageService.uploadFileToStorage.bind(StorageService);
export const generatePresignedUrl = StorageService.generatePresignedUrl.bind(StorageService);
export const getFileMetadata = StorageService.getFileMetadata.bind(StorageService);
export const deleteFile = StorageService.deleteFile.bind(StorageService);
export const generateDownloadUrl = StorageService.generateDownloadUrl.bind(StorageService);
export const validateFileType = StorageService.validateFileType.bind(StorageService);
export const validateFileSize = StorageService.validateFileSize.bind(StorageService);
export const getFileExtension = StorageService.getFileExtension.bind(StorageService);
export const getMimeTypeFromFilename = StorageService.getMimeTypeFromFilename.bind(StorageService);