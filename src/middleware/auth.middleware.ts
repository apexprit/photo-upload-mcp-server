import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { FirestoreService } from '../services/firestore.service';

/**
 * Authentication middleware for MCP server
 * Supports multiple authentication methods:
 * 1. API Key (X-API-Key header)
 * 2. JWT Token (Authorization: Bearer <token>)
 * 3. Service Account (for internal services)
 */
export const authMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    // Extract authentication credentials
    const apiKey = req.headers['x-api-key'] as string;
    const authHeader = req.headers.authorization;
    
    let user = null;
    
    // Try API Key authentication first
    if (apiKey) {
      user = await authenticateWithApiKey(apiKey);
    }
    // Try Bearer token authentication
    else if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      user = await authenticateWithToken(token);
    }
    // Try service account (for internal services)
    else if (req.headers['x-service-account']) {
      user = await authenticateServiceAccount(req.headers['x-service-account'] as string);
    }
    
    // If no authentication method succeeded
    if (!user) {
      throw ApiError.unauthorized(
        'Authentication required. Provide API key (X-API-Key header) or Bearer token.',
        {
          supportedMethods: ['api_key', 'bearer_token', 'service_account'],
          headers: {
            apiKey: 'X-API-Key: <your-api-key>',
            bearerToken: 'Authorization: Bearer <your-jwt-token>'
          }
        }
      );
    }
    
    // Attach user to request object
    (req as any).user = user;
    
    // Log authentication success (in production, you might want to audit this)
    console.log(`Authenticated user: ${user.email} (${user.id}) for ${req.method} ${req.path}`);
    
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(ApiError.unauthorized('Authentication failed', { originalError: (error as Error).message }));
    }
  }
};

/**
 * Authenticate using API Key
 */
async function authenticateWithApiKey(apiKey: string): Promise<any> {
  // For development/testing, accept a test API key without Firestore validation
  if (process.env.NODE_ENV === 'development' && apiKey === 'test-api-key') {
    console.log('Development mode: Accepting test API key');
    return {
      id: 'test-user-123',
      email: 'test-user@example.com',
      role: 'user',
      permissions: ['files.read', 'files.write', 'metadata.read', 'metadata.write'],
      authMethod: 'api_key'
    };
  }
  
  // Check if we're in development mode (NODE_ENV not set or equals 'development')
  const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
  
  // For development, accept test API key
  if (isDevelopment && apiKey === 'test-api-key') {
    console.log('Development mode: Accepting test API key');
    return {
      id: 'test-user-123',
      email: 'test-user@example.com',
      role: 'user',
      permissions: ['files.read', 'files.write', 'metadata.read', 'metadata.write'],
      authMethod: 'api_key'
    };
  }
  
  // For development with non-test API key, try Firestore validation but fall back
  if (isDevelopment) {
    try {
      const validationResult = await FirestoreService.validateApiKey(apiKey);
      
      if (!validationResult.isValid) {
        throw ApiError.unauthorized('Invalid or expired API key');
      }
      
      return {
        id: validationResult.userId || 'api-user',
        email: `api-user-${validationResult.userId}@example.com`,
        role: 'api',
        permissions: validationResult.permissions || [],
        authMethod: 'api_key'
      };
    } catch (error) {
      console.log('Firestore validation failed in development:', (error as Error).message);
      throw ApiError.unauthorized('Invalid or expired API key. In development, use "test-api-key"');
    }
  }
  
  // For production, require proper validation
  const validationResult = await FirestoreService.validateApiKey(apiKey);
  
  if (!validationResult.isValid) {
    throw ApiError.unauthorized('Invalid or expired API key');
  }
  
  return {
    id: validationResult.userId || 'api-user',
    email: `api-user-${validationResult.userId}@example.com`,
    role: 'api',
    permissions: validationResult.permissions || [],
    authMethod: 'api_key'
  };
}

/**
 * Authenticate using JWT token
 */
async function authenticateWithToken(token: string): Promise<any> {
  try {
    // In a real implementation, you would:
    // 1. Verify JWT signature
    // 2. Check token expiration
    // 3. Validate token claims
    // 4. Fetch user from database
    
    // For prototype purposes, we'll implement a simple mock
    if (token === 'mock-valid-token') {
      return {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
        permissions: ['files.read', 'files.write'],
        authMethod: 'jwt'
      };
    }
    
    // Check if it's a Firebase ID token
    if (token.startsWith('firebase-')) {
      return await authenticateFirebaseToken(token);
    }
    
    throw new Error('Invalid token');
  } catch (error) {
    throw ApiError.unauthorized('Invalid or expired token', { details: (error as Error).message });
  }
}

/**
 * Authenticate Firebase ID token
 */
async function authenticateFirebaseToken(_token: string): Promise<any> {
  // In a real implementation with Firebase Auth:
  // import * as admin from 'firebase-admin';
  // const decodedToken = await admin.auth().verifyIdToken(token);
  // const user = await admin.auth().getUser(decodedToken.uid);
  
  // For prototype, return mock user
  return {
    id: 'firebase-user-123',
    email: 'firebase-user@example.com',
    role: 'user',
    permissions: ['files.read', 'files.write', 'metadata.read'],
    authMethod: 'firebase'
  };
}

/**
 * Authenticate service account
 */
async function authenticateServiceAccount(serviceAccountId: string): Promise<any> {
  // In a real implementation, you would validate the service account
  // using Google Cloud IAM or a service account registry
  
  // For prototype, accept a few mock service accounts
  const validServiceAccounts = ['mcp-service', 'upload-processor', 'backup-service'];
  
  if (!validServiceAccounts.includes(serviceAccountId)) {
    throw ApiError.unauthorized('Invalid service account');
  }
  
  return {
    id: serviceAccountId,
    email: `${serviceAccountId}@example.com`,
    role: 'service',
    permissions: ['files.read', 'files.write', 'metadata.read', 'metadata.write'],
    authMethod: 'service_account'
  };
}

/**
 * Role-based authorization middleware
 */
export const requireRole = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(
        `Insufficient permissions. Required role: ${roles.join(' or ')}`,
        { userRole: req.user.role }
      ));
    }
    
    next();
  };
};

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (...permissions: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }
    
    const userPermissions = req.user.permissions || [];
    const hasAllPermissions = permissions.every(permission => 
      userPermissions.includes(permission)
    );
    
    if (!hasAllPermissions) {
      return next(ApiError.forbidden(
        `Missing required permissions: ${permissions.join(', ')}`,
        { 
          userPermissions,
          requiredPermissions: permissions 
        }
      ));
    }
    
    next();
  };
};

/**
 * Optional authentication middleware
 * Sets req.user if authenticated, but doesn't fail if not
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const authHeader = req.headers.authorization;
    
    if (apiKey) {
      req.user = await authenticateWithApiKey(apiKey);
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      req.user = await authenticateWithToken(token);
    }
    // If no authentication provided, req.user remains undefined
  } catch (error) {
    // Silently fail for optional auth - don't set req.user
    console.log('Optional authentication failed:', (error as Error).message);
  }
  
  next();
};