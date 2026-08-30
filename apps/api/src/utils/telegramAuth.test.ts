import { describe, it, expect } from 'vitest';
import { verifyTelegramAuth } from './telegramAuth';

describe('Telegram Auth HMAC Verification', () => {
  it('Invalid hash should be rejected', () => {
    const fakeData = {
      id: 12345678,
      first_name: 'TestUser',
      auth_date: Math.floor(Date.now() / 1000),
      hash: 'invalid_hash_string',
    };

    const isValid = verifyTelegramAuth(fakeData, 'dummy_token');
    expect(isValid).toBe(false);
  });

  it('Expired auth_date should be rejected', () => {
    const expiredData = {
      id: 12345678,
      first_name: 'TestUser',
      auth_date: Math.floor(Date.now() / 1000) - 90000, // > 24 hours ago
      hash: 'any_hash',
    };

    const isValid = verifyTelegramAuth(expiredData, 'dummy_token');
    expect(isValid).toBe(false);
  });
});
