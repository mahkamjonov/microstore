import assert from 'assert';
import { verifyTelegramAuth } from './telegramAuth.js';

console.log('🧪 Running Telegram Auth Tests...');

// Test 1: Invalid hash
const fakeData = {
  id: 12345678,
  first_name: 'TestUser',
  auth_date: Math.floor(Date.now() / 1000),
  hash: 'invalid_hash_string',
};

const isValid1 = verifyTelegramAuth(fakeData, 'dummy_token');
assert.strictEqual(isValid1, false, 'Invalid hash must return false');
console.log('✅ Test 1 Passed: Invalid hash rejected');

// Test 2: Expired date
const expiredData = {
  id: 12345678,
  first_name: 'TestUser',
  auth_date: Math.floor(Date.now() / 1000) - 90000,
  hash: 'any_hash',
};

const isValid2 = verifyTelegramAuth(expiredData, 'dummy_token');
assert.strictEqual(isValid2, false, 'Expired auth date must return false');
console.log('✅ Test 2 Passed: Expired auth date rejected');

console.log('🎉 All Telegram Auth Unit Tests PASSED successfully!');
