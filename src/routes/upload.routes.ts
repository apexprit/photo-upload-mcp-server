import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { FileMetadata } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

const router = Router();

// Configure multer for memory storage (for Cloud Run)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Simple file type validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'text/plain', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

/**
 * Upload a file
 * POST /api/v1/upload
 */
router.post('/', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      // Handle multer errors
      if (err.name === 'MulterError') {
        return next(new ApiError(400, `File upload error: ${err.message}`));
      }
      // Handle other errors
      return next(new ApiError(500, `Upload processing error: ${err.message}`));
    }
    next();
  });
}, asyncHandler(async (req: any, res: any) => {
  if (!req.file) {
    throw new ApiError(400, 'No file uploaded');
  }

  // Extract user ID from auth middleware
  const userId = req.user?.id || 'anonymous';
  const userEmail = req.user?.email || 'unknown@example.com';

  // Validate file size (10MB limit)
  if (req.file.size > 10 * 1024 * 1024) {
    throw new ApiError(400, 'File size exceeds limit (10MB)');
  }

  // Generate unique file ID
  const fileId = uuidv4();
  const originalName = req.file.originalname;
  const fileExtension = originalName.split('.').pop() || 'bin';
  const fileName = `${fileId}.${fileExtension}`;

  // In a real implementation, this would upload to Cloud Storage
  // For testing, we'll simulate a storage URL
  const storageUrl = `https://storage.googleapis.com/mcp-files/${fileName}`;

  // Prepare metadata
  const metadata: FileMetadata = {
    fileId,
    fileName: originalName,
    storagePath: fileName,
    storageUrl,
    mimeType: req.file.mimetype,
    size: req.file.size,
    uploadedBy: userId,
    uploadedByEmail: userEmail,
    uploadDate: new Date().toISOString(),
    permissions: {
      owner: userId,
      viewers: [userId],
      editors: [userId]
    },
    tags: [],
    isPublic: false
  };

  // In a real implementation, this would save to Firestore
  // For testing, we'll just return the metadata
  const savedMetadata = metadata;

  res.status(201).json({
    success: true,
    message: 'File uploaded successfully',
    data: {
      fileId: savedMetadata.fileId,
      fileName: savedMetadata.fileName,
      storageUrl: savedMetadata.storageUrl,
      mimeType: savedMetadata.mimeType,
      size: savedMetadata.size,
      uploadDate: savedMetadata.uploadDate,
      metadataUrl: `/api/v1/metadata/${savedMetadata.fileId}`
    }
  });
}));

/**
 * Generate a presigned URL for direct upload to Cloud Storage
 * GET /api/v1/upload/presigned-url
 */
router.get('/presigned-url', asyncHandler(async (req: any, res: any) => {
  const fileName = req.query.fileName as string;
  const contentType = req.query.contentType as string || 'application/octet-stream';
  // const userId = req.user?.id || 'anonymous';

  if (!fileName) {
    throw new ApiError(400, 'fileName query parameter is required');
  }

  // Generate a unique file ID
  const fileId = uuidv4();
  const fileExtension = fileName.split('.').pop() || 'bin';
  const storageFileName = `${fileId}.${fileExtension}`;

  // In a real implementation, this would generate a signed URL
  // For testing, we'll return a mock URL
  const uploadUrl = `https://storage.googleapis.com/mcp-files/${storageFileName}?uploadType=resumable`;

  res.json({
    success: true,
    data: {
      fileId,
      uploadUrl,
      storagePath: storageFileName,
      method: 'PUT',
      headers: {
        'Content-Type': contentType
      }
    }
  });
}));

export default router;