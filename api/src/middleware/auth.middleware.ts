import { Request, Response, NextFunction } from 'express';
import { verify } from 'jsonwebtoken';
import { JwtPayload, ApiResponse } from '../types';
import { config } from '../config';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.',
        error: 'NO_TOKEN',
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Invalid token format',
        error: 'INVALID_TOKEN_FORMAT',
      });
      return;
    }

    const decoded = verify(token, config.jwt.secret) as JwtPayload;

    req.userId = decoded.userId;
    req.userEmail = decoded.email;

    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        res.status(401).json({
          success: false,
          message: 'Token expired. Please login again.',
          error: 'TOKEN_EXPIRED',
        });
        return;
      }

      if (error.name === 'JsonWebTokenError') {
        res.status(401).json({
          success: false,
          message: 'Invalid token',
          error: 'INVALID_TOKEN',
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: 'AUTH_ERROR',
    });
  }
};

export const optionalAuthMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const decoded = verify(token, config.jwt.secret) as JwtPayload;
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
      }
    }

    next();
  } catch {
    next();
  }
};
