import crypto from 'crypto';

export interface TelegramAuthData {
  id: number | string;
  first_name: string;
  username?: string;
  auth_date: number;
  hash: string;
}

export function verifyTelegramAuth(data: TelegramAuthData, botToken: string): boolean {
  if (!data || !data.hash) return false;

  const { hash, ...userData } = data;

  // 1. Data-check string (sorted alphabetically)
  const dataCheckArr = Object.keys(userData)
    .sort()
    .map((key) => `${key}=${(userData as Record<string, any>)[key]}`);
  const dataCheckString = dataCheckArr.join('\n');

  // 2. Secret key = HMAC-SHA256("WebAppData", botToken)
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  // 3. Calculated Hash = HMAC-SHA256(secretKey, dataCheckString)
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // 4. Validate auth_date (must be within last 86400 seconds)
  const now = Math.floor(Date.now() / 1000);
  if (data.auth_date && now - data.auth_date > 86400) {
    return false;
  }

  return calculatedHash === hash;
}
