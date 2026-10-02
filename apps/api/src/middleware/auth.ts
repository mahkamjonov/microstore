import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@microstore/database';
import { getJwtSecret, passwordVersion } from '../utils/token.js';

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
  pv?: string;
}

const unauthorized = (res: Response, code: string, message: string) =>
  res.status(401).json({ success: false, error: { code, message } });

export async function authGuard(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'UNAUTHORIZED', "Avtorizatsiyadan o'tilmagan. Iltimos, qayta kiring.");
  }

  let decoded: JWTPayload;
  try {
    decoded = jwt.verify(authHeader.split(' ')[1], getJwtSecret()) as JWTPayload;
  } catch {
    return unauthorized(res, 'INVALID_TOKEN', "Token yaroqsiz yoki muddati o'tgan. Qayta kiring.");
  }

  if (!decoded?.sub) {
    return unauthorized(res, 'INVALID_TOKEN', "Token ma'lumotlari noto'g'ri");
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user || decoded.pv !== passwordVersion(user.passwordHash)) {
      return unauthorized(res, 'INVALID_TOKEN', "Sessiya tugagan. Qayta kiring.");
    }

    const requestedStoreId = String(req.headers['x-store-id'] || '').trim();
    let storeId = user.storeId;

    if (user.role !== 'cashier' && requestedStoreId && requestedStoreId !== user.storeId) {
      const ownedStore = await prisma.store.findFirst({
        where: { id: requestedStoreId, ownerId: user.id },
        select: { id: true },
      });
      if (!ownedStore) {
        return res.status(403).json({
          success: false,
          error: { code: 'STORE_FORBIDDEN', message: "Bu do'konga kirish huquqingiz yo'q." },
        });
      }
      storeId = ownedStore.id;
    }

    req.userId = user.id;
    req.storeId = storeId;
    req.phone = user.telegramId;
    req.role = user.role;
    next();
  } catch (error) {
    console.error('authGuard error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Server xatosi. Keyinroq urinib ko\'ring.' },
    });
  }
}

export function requireOwner(req: Request, res: Response, next: NextFunction) {
  if (req.role === 'cashier') {
    return res.status(403).json({
      success: false,
      error: { code: 'OWNER_ONLY', message: "Bu amal faqat do'kon egasi uchun ochiq." },
    });
  }
  next();
}
