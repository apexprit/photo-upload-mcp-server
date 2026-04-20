import { Request, Response, NextFunction } from 'express';

/**
 * Async handler to wrap async route handlers and catch errors
 * This eliminates the need for try-catch blocks in route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Alternative async handler that returns a function
 */
export function asyncHandler2<T extends Function>(fn: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}