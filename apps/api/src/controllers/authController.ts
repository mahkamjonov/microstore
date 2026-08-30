import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { verifyTelegramAuth } from '../utils/telegramAuth.js';
import { prisma } from '@microstore/database';

export async function telegramAuthHandler(req: Request, res: Response) {
  try {
    const authData = req.body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN || 'demo_bot_token';

    // Verify hash if in production, or bypass for demo if bot token isn't set
    const isValid = process.env.NODE_ENV === 'production' 
      ? verifyTelegramAuth(authData, botToken)
      : true;

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TELEGRAM_HASH', message: 'Telegram autentifikatsiyasi tasdiqlanmadi' },
      });
    }

    const telegramId = String(authData.id || '123456789');
    const firstName = authData.first_name || 'Sotuvchi';
    const username = authData.username || undefined;

    // Find or create store & user
    let user = await prisma.user.findUnique({
      where: { telegramId },
      include: { store: true },
    });

    if (!user) {
      const store = await prisma.store.create({
        data: {
          name: `${firstName} Do'koni`,
        },
      });

      user = await prisma.user.create({
        data: {
          telegramId,
          firstName,
          username,
          storeId: store.id,
        },
        include: { store: true },
      });
    }

    const secret = process.env.JWT_SECRET || 'microstore_jwt_secret_dev';
    const token = jwt.sign(
      {
        sub: user.id,
        storeId: user.storeId,
        telegramId: user.telegramId,
      },
      secret,
      { expiresIn: '90d' }
    );

    return res.status(200).json({
      success: true,
      token,
      store: {
        id: user.storeId,
        name: user.store.name,
      },
      user: {
        id: user.id,
        firstName: user.firstName,
      },
    });
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Autentifikatsiya xatoligi' },
    });
  }
}
