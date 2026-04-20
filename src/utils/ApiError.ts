/**
 * Custom API Error class for consistent error handling
 */
export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  details?: any;

  constructor(
    statusCode: number,
    message: string,
    details?: any,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
    
    // Set prototype explicitly (for instanceof checks)
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /**
   * Convert error to JSON response format
   */
  toJSON() {
    return {
      error: {
        code: this.statusCode,
        message: this.message,
        details: this.details,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Create a bad request error (400)
   */
  static badRequest(message: string, details?: any) {
    return new ApiError(400, message, details);
  }

  /**
   * Create an unauthorized error (401)
   */
  static unauthorized(message = 'Unauthorized', details?: any) {
    return new ApiError(401, message, details);
  }

  /**
   * Create a forbidden error (403)
   */
  static forbidden(message = 'Forbidden', details?: any) {
    return new ApiError(403, message, details);
  }

  /**
   * Create a not found error (404)
   */
  static notFound(message = 'Resource not found', details?: any) {
    return new ApiError(404, message, details);
  }

  /**
   * Create a validation error (422)
   */
  static validationError(message = 'Validation failed', details?: any) {
    return new ApiError(422, message, details);
  }

  /**
   * Create an internal server error (500)
   */
  static internal(message = 'Internal server error', details?: any) {
    return new ApiError(500, message, details, false);
  }
}