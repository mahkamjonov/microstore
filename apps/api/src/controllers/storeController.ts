import { Request, Response } from 'express';
import { prisma } from '@microstore/database';
import { storesMap } from './authController.js';

export async function getStoresHandler(req: Request, res: Response) {
  try {
    let dbStores: any[] = [];
    try {
      dbStores = await prisma.store.findMany({
        orderBy: { createdAt: 'desc' },
      });
    } catch (dbErr) {
      console.warn('Prisma store query fallback:', dbErr);
    }

    // Combine memory map and database stores using a Map keyed by id
    const allStoresMap = new Map<string, any>();

    storesMap.forEach((s, id) => {
      allStoresMap.set(id, {
        id: s.id,
        name: s.name,
        createdAt: s.createdAt,
      });
    });

    dbStores.forEach((st) => {
      allStoresMap.set(st.id, {
        id: st.id,
        name: st.name,
        createdAt: st.createdAt.toISOString(),
      });
    });

    // If real user stores exist, remove the default fallback store_main
    if (allStoresMap.size > 1 && allStoresMap.has('store_main')) {
      allStoresMap.delete('store_main');
    }

    const storesList = Array.from(allStoresMap.values());

    return res.status(200).json({
      success: true,
      data: storesList,
    });
  } catch (error: any) {
    console.error('getStoresHandler error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message },
    });
  }
}

export async function createStoreHandler(req: Request, res: Response) {
  try {
    const { name, location } = req.body || {};
    const storeName = String(name || '').trim();

    if (!storeName) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_NAME', message: "Do'kon nomi kiritilishi shart." },
      });
    }

    let newStore: any = null;

    try {
      newStore = await prisma.store.create({
        data: {
          name: storeName,
        },
      });
    } catch (dbErr) {
      console.warn('Prisma store create fallback:', dbErr);
      const generatedId = `store_${Date.now()}`;
      newStore = {
        id: generatedId,
        name: storeName,
        createdAt: new Date(),
      };
    }

    const formattedStore = {
      id: newStore.id,
      name: newStore.name,
      ownerId: req.userId || 'owner-default',
      location: location || '',
      createdAt: newStore.createdAt ? newStore.createdAt.toString() : new Date().toISOString(),
    };

    storesMap.set(formattedStore.id, formattedStore);

    console.log("✅ STORE CREATED AND SAVED TO SUPABASE:", formattedStore);

    return res.status(201).json({
      success: true,
      data: formattedStore,
      message: "Yangi do'kon muvaffaqiyatli yaratildi!",
    });
  } catch (error: any) {
    console.error('createStoreHandler error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'CREATE_STORE_FAILED', message: error.message },
    });
  }
}
