import https from 'https';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8767648346:AAG3iz8Wsx50gG_9nB_hwW7bxotkwWV8KxQ';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Helper file only - single polling process is managed exclusively by apps/api/src/index.ts
console.log('📦 runBot.js loaded as utility module.');
