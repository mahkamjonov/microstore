import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyWebAppInitData } from './telegramInitData.js';

const TOKEN = '123456:TEST-TOKEN';

export function signInitData(user: object, token = TOKEN, authDate = Math.floor(Date.now() / 1000)) {
  const params = new URLSearchParams({
    query_id: 'AAH-test',
    user: JSON.stringify(user),
    auth_date: String(authDate),
  });
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex'));
  return params.toString();
}

const user = { id: 777001, first_name: 'Ali', username: 'ali_u' };

// valid signature
assert.deepEqual(verifyWebAppInitData(signInitData(user), TOKEN), { id: 777001, firstName: 'Ali', username: 'ali_u' });

// wrong bot token
assert.equal(verifyWebAppInitData(signInitData(user, 'other:TOKEN'), TOKEN), null);

// tampered payload (another user id)
const tampered = signInitData(user).replace('777001', '777002');
assert.equal(verifyWebAppInitData(tampered, TOKEN), null);

// missing hash / empty input
assert.equal(verifyWebAppInitData('user=%7B%7D&auth_date=1', TOKEN), null);
assert.equal(verifyWebAppInitData('', TOKEN), null);
assert.equal(verifyWebAppInitData(signInitData(user), ''), null);

// expired (older than 24h) and from the future
assert.equal(verifyWebAppInitData(signInitData(user, TOKEN, Math.floor(Date.now() / 1000) - 90000), TOKEN), null);
assert.equal(verifyWebAppInitData(signInitData(user, TOKEN, Math.floor(Date.now() / 1000) + 3600), TOKEN), null);

console.log('telegramInitData tests passed');
