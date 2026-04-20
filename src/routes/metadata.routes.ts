import { Router } from 'express';
import { FirestoreService } from '../services/firestore.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

const router = Router();

/**
 * @route GET /api/v1/metadata
 * @desc List files with pagination and filtering
 * @access Private (requires authentication)
 */
router.get('/', asyncHandler(async (req: any, res: any) => {
  const userId = req.user?.id || 'anonymous';
  const { 
    limit = 20, 
    offset = 0,
    uploadedBy,
    mimeType,
    tag,
    isPublic
  } = req.query;

  // Parse boolean
  const isPublicBool = isPublic === 'true' ? true : 
                      isPublic === 'false' ? false : undefined;

  // For simplicity, we'll just list files for the current user
  // In a real implementation, you'd apply filters
  const result = await FirestoreService.listFiles(
    userId,
    parseInt(limit as string),
    parseInt(offset as string)
  );

  // Apply filters manually (simplified)
  let filteredFiles = result.files;
  if (uploadedBy) {
    filteredFiles = filteredFiles.filter(file => file.uploadedBy === uploadedBy);
  }
  if (mimeType) {
    filteredFiles = filteredFiles.filter(file => file.mimeType === mimeType);
  }
  if (isPublicBool !== undefined) {
    filteredFiles = filteredFiles.filter(file => file.isPublic === isPublicBool);
  }
  if (tag) {
    filteredFiles = filteredFiles.filter(file => file.tags.includes(tag as string));
  }

  res.json({
    success: true,
    data: {
      files: filteredFiles,
      pagination: {
        total: filteredFiles.length,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: filteredFiles.length === parseInt(limit as string)
      }
    }
  });
}));

/**
 * @route GET /api/v1/metadata/:fileId
 * @desc Get file metadata by ID
 * @access Private (requires authentication and permission)
 */
router.get('/:fileId', asyncHandler(async (req: any, res: any) => {
  const { fileId } = req.params;
  const userId = req.user?.id || 'anonymous';

  const metadata = await FirestoreService.getFileMetadata(fileId);
  
  if (!metadata) {
    throw new ApiError(404, 'File not found');
  }

  // Check permission
  if (!FirestoreService.canViewFile(metadata, userId)) {
    throw new ApiError(403, 'You do not have permission to view this file');
  }

  res.json({
    success: true,
    data: metadata
  });
}));

/**
 * @route PUT /api/v1/metadata/:fileId
 * @desc Update file metadata
 * @access Private (requires authentication and edit permission)
 */
router.put('/:fileId', asyncHandler(async (req: any, res: any) => {
  const { fileId } = req.params;
  const userId = req.user?.id || 'anonymous';
  const userEmail = req.user?.email || 'unknown@example.com';
  const updates = req.body;

  // Get current metadata to check permissions
  const currentMetadata = await FirestoreService.getFileMetadata(fileId);
  
  if (!currentMetadata) {
    throw new ApiError(404, 'File not found');
  }

  if (!FirestoreService.canEditFile(currentMetadata, userId)) {
    throw new ApiError(403, 'You do not have permission to edit this file');
  }

  const updatedMetadata = await FirestoreService.updateFileMetadata(fileId, {
    ...updates,
    updatedBy: userId,
    updatedByEmail: userEmail
  });

  res.json({
    success: true,
    data: updatedMetadata
  });
}));

/**
 * @route DELETE /api/v1/metadata/:fileId
 * @desc Delete file metadata
 * @access Private (requires authentication and owner permission)
 */
router.delete('/:fileId', asyncHandler(async (req: any, res: any) => {
  const { fileId } = req.params;
  const userId = req.user?.id || 'anonymous';
  const userEmail = req.user?.email || 'unknown@example.com';

  const metadata = await FirestoreService.getFileMetadata(fileId);
  
  if (!metadata) {
    throw new ApiError(404, 'File not found');
  }

  // Only owner can delete
  if (metadata.permissions.owner !== userId) {
    throw new ApiError(403, 'Only the file owner can delete this file');
  }

  await FirestoreService.deleteFileMetadata(fileId, userId, userEmail);

  res.json({
    success: true,
    message: 'File metadata deleted successfully'
  });
}));

/**
 * @route PUT /api/v1/metadata/:fileId/permissions
 * @desc Update file permissions
 * @access Private (requires authentication and owner permission)
 */
router.put('/:fileId/permissions', asyncHandler(async (req: any, res: any) => {
  const { fileId } = req.params;
  const userId = req.user?.id || 'anonymous';
  const userEmail = req.user?.email || 'unknown@example.com';
  const { permissions } = req.body;

  const metadata = await FirestoreService.getFileMetadata(fileId);
  
  if (!metadata) {
    throw new ApiError(404, 'File not found');
  }

  // Only owner can update permissions
  if (metadata.permissions.owner !== userId) {
    throw new ApiError(403, 'Only the file owner can update permissions');
  }

  await FirestoreService.updateFilePermissions(fileId, permissions, userId, userEmail);

  res.json({
    success: true,
    message: 'File permissions updated successfully'
  });
}));

/**
 * @route POST /api/v1/metadata/:fileId/share
 * @desc Share file with another user
 * @access Private (requires authentication and owner permission)
 */
router.post('/:fileId/share', asyncHandler(async (req: any, res: any) => {
  const { fileId } = req.params;
  const userId = req.user?.id || 'anonymous';
  const userEmail = req.user?.email || 'unknown@example.com';
  const { targetUserId, targetUserEmail, permission } = req.body;

  if (!targetUserId || !permission) {
    throw new ApiError(400, 'targetUserId and permission are required');
  }

  if (!['view', 'edit'].includes(permission)) {
    throw new ApiError(400, 'Permission must be "view" or "edit"');
  }

  const metadata = await FirestoreService.getFileMetadata(fileId);
  
  if (!metadata) {
    throw new ApiError(404, 'File not found');
  }

  if (!FirestoreService.canEditFile(metadata, userId)) {
    throw new ApiError(403, 'You do not have permission to share this file');
  }

  // Create updated permissions
  const updatedPermissions = { ...metadata.permissions };
  
  // Initialize sharedWith array if it doesn't exist
  if (!updatedPermissions.sharedWith) {
    updatedPermissions.sharedWith = [];
  }

  // Remove existing permission for this user if it exists
  updatedPermissions.sharedWith = updatedPermissions.sharedWith.filter(
    (shared: any) => shared.userId !== targetUserId
  );

  // Add new permission
  updatedPermissions.sharedWith.push({
    userId: targetUserId,
    userEmail: targetUserEmail || `${targetUserId}@example.com`,
    permission,
    grantedBy: userId,
    grantedAt: new Date().toISOString()
  });

  await FirestoreService.updateFilePermissions(fileId, updatedPermissions, userId, userEmail);

  res.json({
    success: true,
    message: `File shared with ${targetUserId} (${permission} permission)`
  });
}));

export default router;