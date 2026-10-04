import crypto from 'crypto';

export interface TelegramWebAppUser {
  id: number;
  firstName: string;
  username?: string;
}

// Validates the `initData` string a Telegram Mini App receives (see "Validating data received via the Mini App").
export function verifyWebAppInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400,
  nowSeconds = Math.floor(Date.now() / 1000)
): TelegramWebAppUser | null {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const given = Buffer.from(hash, 'hex');
  const wanted = Buffer.from(expected, 'hex');
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || nowSeconds - authDate > maxAgeSeconds || authDate - nowSeconds > 300) {
    return null;
  }

  try {
    const user = JSON.parse(params.get('user') || '');
    if (typeof user?.id !== 'number') return null;
    return { id: user.id, firstName: String(user.first_name || ''), username: user.username };
  } catch {
    return null;
  }
}
