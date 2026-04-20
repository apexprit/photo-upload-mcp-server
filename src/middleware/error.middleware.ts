import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';

/**
 * Global error handling middleware
 * Catches all errors and returns consistent JSON responses
 */
export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Default error values
  let statusCode = 500;
  let message = 'Internal server error';
  let details: any = undefined;
  let isOperational = false;

  // Handle ApiError instances
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
    isOperational = err.isOperational;
  }
  // Handle validation errors (e.g., from Joi or class-validator)
  else if (err.name === 'ValidationError') {
    statusCode = 422;
    message = 'Validation failed';
    details = err.message;
    isOperational = true;
  }
  // Handle JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    isOperational = true;
  }
  // Handle token expiration
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    isOperational = true;
  }
  // Handle multer file upload errors
  else if (err.name === 'MulterError') {
    statusCode = 400;
    message = `File upload error: ${err.message}`;
    isOperational = true;
  }
  // Handle MongoDB duplicate key errors
  else if (err.name === 'MongoError' && (err as any).code === 11000) {
    statusCode = 409;
    message = 'Duplicate key error';
    details = (err as any).keyValue;
    isOperational = true;
  }

  // Log error details (in production, you might want to use a proper logger)
  const logDetails = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    statusCode,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    isOperational,
    user: (req as any).user?.id || 'anonymous'
  };

  console.error('Error occurred:', logDetails);

  // In development, include stack trace
  const response: any = {
    error: {
      code: statusCode,
      message,
      ...(details && { details }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  };

  // Send error response
  res.status(statusCode).json(response);

  // If it's an operational error, we don't need to crash
  // If it's a programming error, we might want to restart in production
  if (!isOperational && process.env.NODE_ENV === 'production') {
    // Here you would typically:
    // 1. Send notification to developers
    // 2. Gracefully shutdown
    // 3. Restart the process
    console.error('Non-operational error detected, consider restarting:', err);
  }
};

/**
 * 404 Not Found middleware
 * Should be placed after all routes
 */
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => {
  const error = new ApiError(404, `Cannot ${req.method} ${req.originalUrl}`);
  next(error);
};

/**
 * Async error wrapper for routes that don't use asyncHandler
 */
export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validate request body against a schema
 */
export const validateRequest = (schema: any) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const validationErrors = error.details.map((detail: any) => ({
          field: detail.path.join('.'),
          message: detail.message,
          type: detail.type
        }));

        throw ApiError.validationError('Validation failed', {
          errors: validationErrors
        });
      }

      // Replace request body with validated values
      req.body = value;
      next();
    } catch (err) {
      next(err);
    }
  };
};