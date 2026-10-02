import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const DEV_FALLBACK_SECRET = 'microstore_jwt_secret_dev';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  return DEV_FALLBACK_SECRET;
}

// Changes whenever the password changes, so old tokens stop working after a password change.
export function passwordVersion(passwordHash: string | null | undefined): string {
  return crypto.createHmac('sha256', getJwtSecret()).update(passwordHash || '').digest('hex').slice(0, 16);
}

export interface TokenUser {
  id: string;
  role: string;
  storeId: string;
  telegramId: string;
  passwordHash: string | null;
}

export function signToken(user: TokenUser): string {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      storeId: user.storeId,
      phone: user.telegramId,
      pv: passwordVersion(user.passwordHash),
    },
    getJwtSecret(),
    { expiresIn: '90d' }
  );
}
