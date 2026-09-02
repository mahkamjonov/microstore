import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      storeId?: string;
      userId?: string;
      phone?: string;
      role?: string;
    }
  }
}

interface JWTPayload {
  sub: string;
  storeId: string;
  phone?: string;
  role?: string;
}

export function authGuard(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: "Avtorizatsiyadan o'tilmagan. Iltimos, qayta kiring.",
      },
    });
  }

  const token = authHeader.split(' ')[1];

  // Demo fallback token support for instant client compatibility
  if (token && token.startsWith('demo_token_')) {
    req.userId = 'owner-default';
    const xStoreId = req.headers['x-store-id'] as string;
    req.storeId = (xStoreId && xStoreId.trim()) ? xStoreId.trim() : 'store_main';
    req.phone = '+998901234567';
    req.role = 'owner';
    return next();
  }

  try {
    const secret = process.env.JWT_SECRET || 'microstore_jwt_secret_dev';
    const decoded = jwt.verify(token, secret) as JWTPayload;

    if (!decoded || !decoded.sub || !decoded.storeId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: "Token ma'lumotlari noto'g'ri",
        },
      });
    }

    req.userId = decoded.sub;
    req.storeId = decoded.storeId;
    req.phone = decoded.phone;
    req.role = decoded.role;

    const xStoreId = req.headers['x-store-id'] as string;
    if (xStoreId && xStoreId.trim() !== '') {
      req.storeId = xStoreId.trim();
    }

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: "Token yaroqsiz yoki muddati o'tgan. Qayta kiring.",
      },
    });
  }
}
