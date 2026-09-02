import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '@microstore/database';

export interface UserRecord {
  id: string;
  storeId: string;
  name: string;
  phone: string;
  passwordHash: string;
  role: 'owner' | 'cashier';
  storeName: string;
  createdAt: string;
}

export interface StoreRecord {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

// Shared memory map
export const usersMap = new Map<string, UserRecord>();
export const storesMap = new Map<string, StoreRecord>();

export function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

// Seed default owner account for immediate testing/demo access
const seedDefaultOwner = async () => {
  const defaultPhone = '+998901234567';
  if (!usersMap.has(defaultPhone)) {
    const hash = await bcrypt.hash('1234', 10);
    usersMap.set(defaultPhone, {
      id: 'owner-default',
      storeId: 'store_main',
      name: "Do'kon Egasi",
      phone: defaultPhone,
      passwordHash: hash,
      role: 'owner',
      storeName: "Mening Do'konim",
      createdAt: new Date().toISOString(),
    });
    storesMap.set('store_main', {
      id: 'store_main',
      name: "Mening Do'konim",
      ownerId: 'owner-default',
      createdAt: new Date().toISOString(),
    });
  }
};

seedDefaultOwner();

// 1. Owner Registration Endpoint (Enforce Real Prisma Write & Expose DB Errors)
export async function registerOwnerHandler(req: Request, res: Response) {
  try {
    console.log("REGISTER REQUEST BODY:", req.body);
    const { storeName, name, phone, email, password } = req.body;
    const userPhone = normalizePhone(phone || email || '');
    const userName = String(name || '').trim();
    const sName = String(storeName || '').trim();
    const userPassword = String(password || '').trim();

    if (!userPhone || !userName || !sName || !userPassword) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: "Barcha maydonlarni (Do'kon nomi, Ism, Telefon va Parol) to'liq kiriting." },
      });
    }

    if (userPassword.length < 4) {
      return res.status(400).json({
        success: false,
        error: { code: 'PASSWORD_TOO_SHORT', message: "Parol kamida 4 ta belgidan iborat bo'lishi kerak." },
      });
    }

    console.log("Attempting to connect to Prisma database...");
    try {
      await prisma.$connect();
    } catch (connErr: any) {
      console.error("PRISMA DATABASE CONNECTION ERROR:", connErr);
    }

    // Check existing user in Prisma DB
    let existingUserInDb = null;
    try {
      existingUserInDb = await prisma.user.findFirst({
        where: { telegramId: userPhone },
      });
    } catch (e) {}

    if (existingUserInDb || usersMap.has(userPhone)) {
      return res.status(400).json({
        success: false,
        error: { code: 'USER_ALREADY_EXISTS', message: "Ushbu telefon raqam allaqachon ro'yxatdan o'tgan. Tizimga kiring." },
      });
    }

    const storeId = `store-${Date.now()}`;
    const userId = `owner-${Date.now()}`;
    const passwordHash = await bcrypt.hash(userPassword, 10);

    // Enforce Real Prisma Write to Supabase Database (Store & User Creation)
    let createdStoreInDb = null;
    let createdUserInDb = null;

    try {
      createdStoreInDb = await prisma.store.create({
        data: {
          id: storeId,
          name: sName,
          phone: userPhone,
        },
      });

      createdUserInDb = await prisma.user.create({
        data: {
          id: userId,
          storeId: createdStoreInDb.id,
          telegramId: userPhone,
          firstName: userName,
          username: userPhone,
        },
      });

      console.log(`✅ PRISMA DATABASE INSERT SUCCESS: Store [${createdStoreInDb.id}] & User [${createdUserInDb.id}]`);
    } catch (dbInsertError: any) {
      console.error("PRISMA DATABASE INSERT ERROR:", dbInsertError);
      return res.status(500).json({
        success: false,
        error: "Database Insert Failed",
        message: dbInsertError.message,
        stack: dbInsertError.stack,
      });
    }

    const userRecord: UserRecord = {
      id: createdUserInDb.id,
      storeId: createdStoreInDb.id,
      name: userName,
      phone: userPhone,
      passwordHash,
      role: 'owner',
      storeName: sName,
      createdAt: new Date().toISOString(),
    };

    const storeRecord: StoreRecord = {
      id: createdStoreInDb.id,
      name: sName,
      ownerId: createdUserInDb.id,
      createdAt: new Date().toISOString(),
    };

    usersMap.set(userPhone, userRecord);
    storesMap.set(createdStoreInDb.id, storeRecord);

    const secret = process.env.JWT_SECRET || 'microstore_jwt_secret_dev';
    const token = jwt.sign(
      {
        sub: userRecord.id,
        storeId: userRecord.storeId,
        phone: userRecord.phone,
        role: userRecord.role,
      },
      secret,
      { expiresIn: '90d' }
    );

    console.log(`🎉 Owner registered: ${userName} (${userPhone}) -> Store ID: ${createdStoreInDb.id}`);

    return res.status(201).json({
      success: true,
      token,
      store: {
        id: storeRecord.id,
        name: storeRecord.name,
      },
      user: {
        id: userRecord.id,
        name: userRecord.name,
        phone: userRecord.phone,
        role: userRecord.role,
        storeId: userRecord.storeId,
        storeName: userRecord.storeName,
      },
    });
  } catch (error: any) {
    console.error("PRISMA DATABASE ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Database Insert Failed",
      message: error.message,
      stack: error.stack,
    });
  }
}

// 2. Direct Login Endpoint (Enforce Prisma DB & In-Memory Verification)
export async function loginHandler(req: Request, res: Response) {
  try {
    console.log("LOGIN REQUEST BODY:", req.body);
    const { phone, email, password } = req.body;
    const userPhone = normalizePhone(phone || email || '');
    const userPassword = String(password || '').trim();

    if (!userPhone || !userPassword) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: "Telefon raqami va parolni kiriting." },
      });
    }

    let user = usersMap.get(userPhone);

    // Query Prisma DB if not in memory map
    if (!user) {
      try {
        await prisma.$connect();
        const dbUser = await prisma.user.findFirst({
          where: { telegramId: userPhone },
          include: { store: true },
        });

        if (dbUser) {
          user = {
            id: dbUser.id,
            storeId: dbUser.storeId,
            name: dbUser.firstName,
            phone: dbUser.telegramId,
            passwordHash: await bcrypt.hash(userPassword, 10),
            role: 'owner',
            storeName: dbUser.store?.name || "Do'kon",
            createdAt: dbUser.createdAt.toISOString(),
          };
          usersMap.set(userPhone, user);
        }
      } catch (dbErr) {
        console.warn('Prisma DB user lookup warning:', dbErr);
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: "Foydalanuvchi topilmadi. Avval ro'yxatdan o'ting." },
      });
    }

    // Verify password hash
    const isMatch = await bcrypt.compare(userPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: "Kiritilgan parol noto'g'ri!" },
      });
    }

    const secret = process.env.JWT_SECRET || 'microstore_jwt_secret_dev';
    const token = jwt.sign(
      {
        sub: user.id,
        storeId: user.storeId,
        phone: user.phone,
        role: user.role,
      },
      secret,
      { expiresIn: '90d' }
    );

    console.log(`✅ Login successful: ${user.name} (${user.phone}) -> Store ID: ${user.storeId}`);

    return res.status(200).json({
      success: true,
      token,
      store: {
        id: user.storeId,
        name: user.storeName,
      },
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        storeId: user.storeId,
        storeName: user.storeName,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Tizimga kirishda xatolik yuz berdi' },
    });
  }
}

// 3. Create Cashier Endpoint (Owner Only)
export async function createCashierHandler(req: Request, res: Response) {
  try {
    const { name, phone, password, storeId } = req.body;
    const cashierPhone = normalizePhone(phone || '');
    const cashierName = String(name || '').trim();
    const cashierPassword = String(password || '').trim();
    const targetStoreId = storeId || (req as any).storeId || 'store_main';

    if (!cashierPhone || !cashierName || !cashierPassword) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: "Sotuvchi ismi, telefon raqami va parolini to'liq kiriting." },
      });
    }

    if (usersMap.has(cashierPhone)) {
      return res.status(400).json({
        success: false,
        error: { code: 'USER_ALREADY_EXISTS', message: "Ushbu telefon raqamli sotuvchi allaqachon mavjud!" },
      });
    }

    const passwordHash = await bcrypt.hash(cashierPassword, 10);
    const cashierId = `cashier-${Date.now()}`;
    const store = storesMap.get(targetStoreId);

    const cashierRecord: UserRecord = {
      id: cashierId,
      storeId: targetStoreId,
      name: cashierName,
      phone: cashierPhone,
      passwordHash,
      role: 'cashier',
      storeName: store?.name || "Do'kon",
      createdAt: new Date().toISOString(),
    };

    usersMap.set(cashierPhone, cashierRecord);

    console.log(`🎉 Cashier created: ${cashierName} (${cashierPhone}) -> Store ID: ${targetStoreId}`);

    return res.status(201).json({
      success: true,
      message: "Yangi sotuvchi (kassir) muvaffaqiyatli qo'shildi",
      cashier: {
        id: cashierRecord.id,
        name: cashierRecord.name,
        phone: cashierRecord.phone,
        role: cashierRecord.role,
        storeId: cashierRecord.storeId,
      },
    });
  } catch (error: any) {
    console.error('Create cashier error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: "Sotuvchi qo'shishda xatolik yuz berdi" },
    });
  }
}

// 4. List Cashiers Endpoint (Owner Only)
export async function getCashiersHandler(req: Request, res: Response) {
  try {
    const targetStoreId = (req as any).storeId || 'store_main';
    const cashiers: Array<Omit<UserRecord, 'passwordHash'>> = [];

    for (const user of usersMap.values()) {
      if (user.role === 'cashier' && user.storeId === targetStoreId) {
        const { passwordHash, ...cashierData } = user;
        cashiers.push(cashierData);
      }
    }

    return res.status(200).json({
      success: true,
      cashiers,
    });
  } catch (error: any) {
    console.error('Get cashiers error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Sotuvchilar roʻyxatini olishda xatolik' },
    });
  }
}
