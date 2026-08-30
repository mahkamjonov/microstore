import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      storeId?: string;
      userId?: string;
      telegramId?: string;
    }
  }
}

interface JWTPayload {
  sub: string;
  storeId: string;
  telegramId: string;
}

export function authGuard(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  // Development bypass or fallback if token not present for demo
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // For seamless 1-page UI demo, inject default store context if unauthenticated
    req.storeId = 'demo-store-id';
    req.userId = 'demo-user-id';
    req.telegramId = '12345678';
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET || 'microstore_jwt_secret_dev';
    const decoded = jwt.verify(token, secret) as JWTPayload;

    req.userId = decoded.sub;
    req.storeId = decoded.storeId;
    req.telegramId = decoded.telegramId;

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token yaroqsiz yoki muddati o\'tgan',
      },
    });
  }
}
