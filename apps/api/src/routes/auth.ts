import { Router } from 'express';
import { authGuard } from '../middleware/auth.js';
import {
  registerOwnerHandler,
  loginHandler,
  createCashierHandler,
  getCashiersHandler,
} from '../controllers/authController.js';

const router = Router();

// PUBLIC ROUTES (Strictly excluded from JWT / Auth Verification)
router.post('/register', registerOwnerHandler);
router.post('/login', loginHandler);

// PROTECTED ROUTES (Apply JWT / Auth Verification after public routes)
router.use(authGuard);
router.post('/cashiers', createCashierHandler);
router.get('/cashiers', getCashiersHandler);

export default router;
