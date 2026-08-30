import crypto from 'crypto';

export function verifyTelegramAuth(data, botToken) {
  if (!data || !data.hash) return false;

  const { hash, ...userData } = data;

  const dataCheckArr = Object.keys(userData)
    .sort()
    .map((key) => `${key}=${userData[key]}`);
  const dataCheckString = dataCheckArr.join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const now = Math.floor(Date.now() / 1000);
  if (data.auth_date && now - data.auth_date > 86400) {
    return false;
  }

  return calculatedHash === hash;
}
