import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authGuard, requireOwner } from '../middleware/auth.js';
import {
  registerOwnerHandler,
  loginHandler,
  meHandler,
  updateCredentialsHandler,
  createCashierHandler,
  getCashiersHandler,
  deleteCashierHandler,
} from '../controllers/authController.js';

const router = Router();

const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'TOO_MANY_ATTEMPTS', message: "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring." },
  },
});

// PUBLIC ROUTES (no JWT required)
router.post('/register', credentialsLimiter, registerOwnerHandler);
router.post('/login', credentialsLimiter, loginHandler);

// PROTECTED ROUTES
router.use(authGuard);
router.get('/me', meHandler);
router.put('/credentials', credentialsLimiter, updateCredentialsHandler);
router.post('/cashiers', requireOwner, createCashierHandler);
router.get('/cashiers', requireOwner, getCashiersHandler);
router.delete('/cashiers/:id', requireOwner, deleteCashierHandler);

export default router;
