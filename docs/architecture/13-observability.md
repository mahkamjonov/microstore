# 13. Kuzatuvchanlik va Metrikalar (Observability & Monitoring)

## 1. Observability Arxitekturasi ($0 Setup)

MicroStore tizimida xatoliklarni erta aniqlash va server holatini 24/7 nazorat qilish uchun yengil va bepul monitoring vositalari birlashtirilgan.

```mermaid
graph TD
    App[MicroStore PWA & Backend] -->|Client Errors| Sentry[Sentry.io Free Tier]
    App -->|Structured Logs| Console[JSON Console Log Engine]
    App -->|System Alarms| TGAdmin[Telegram Developer Group @MicroStoreAlerts]

    HealthPing[Ping Monitor] -->|Every 10m| HealthAPI[/api/v1/health]
    HealthAPI -->|Status Down| TGAdmin
```

---

## 2. Strukturallashgan Loglar Standarti (Structured JSON Logging)

Barcha backend loglar **JSON formatida** `stdout` ga chiqariladi, bu esa CloudWatch va Vercel Logs bilan 100% integratsiyani ta'minlaydi.

```typescript
export interface LogPayload {
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  storeId?: string;
  userId?: string;
  path?: string;
  error?: any;
  timestamp: string;
}

export function logEvent(payload: Omit<LogPayload, 'timestamp'>) {
  const log: LogPayload = {
    ...payload,
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(log));
}
```

---

## 3. Telegram Critical Alarm System (Xatolik Ogohlantirish Bot)

Bazada yoki serverless function ichida kritik 500 xatolar ro'y berganda, tizim avtomatik ravishda **Developer Telegram Guruhiga** zudlik bilan signal (Alarm) yuboradi.

```typescript
import fetch from 'node-request';

export async function sendCriticalAlarm(errorMessage: string, stack?: string) {
  const alertBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const devChatId = process.env.TELEGRAM_DEV_CHAT_ID; // Xabarlar boradigan guruh IDsi

  if (!alertBotToken || !devChatId) return;

  const text = 
    `🚨 **KRITIK TIZIM XATOSI!**\n\n` +
    `🔴 **Xato:** ${errorMessage}\n` +
    `⏰ **Vaqt:** ${new Date().toLocaleString()}\n` +
    `📋 **Stack:** \`\`\`${stack?.slice(0, 300) || 'No stack'}\`\`\``;

  try {
    await fetch(`https://api.telegram.org/bot${alertBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: devChatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
  } catch (err) {
    console.error('Failed to send Telegram alert:', err);
  }
}
```

---

## 4. Health Check Endpoints (`/api/v1/health`)

Tizim komponentlarining holatini (Database, Telegram API, Memory usage) real-time ko'rsatuvchi yagona endpoint:

```json
{
  "status": "HEALTHY",
  "uptime": 86400,
  "timestamp": "2026-08-29T16:22:00Z",
  "checks": {
    "database": { "status": "UP", "latencyMs": 12 },
    "telegramBot": { "status": "UP" },
    "memory": { "heapUsedMB": 42.5 }
  }
}
```

---

## 5. Ochiq Savollar (Open Questions)

1. *Sentry.io bepul tarifi (5,000 event/oy) tugab qolmasligi uchun faqat 500 statusli xatolarni yuborish filtri yetarlimi?*
2. *Do'konlar soni oshganida metrikalarni vizuallash uchun Grafana + Prometheus klasterini 2-bosqichda sozlash kerakmi?*
