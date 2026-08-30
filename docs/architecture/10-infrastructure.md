# 10. Infratuzilma va Xosting Topologiyasi (Infrastructure Topology)

## 1. Topologiya Diagrammasi ($0/oylik Setup)

MicroStore infratuzilmasi **$0 operatsion oylik byudjet** va **99.9% Uptime** kafolatiga erishish uchun global Serverless va Managed Cloud xizmatlariga asoslangan.

```mermaid
graph TD
    User((Sotuvchi Browser / Mobile)) -->|HTTPS / Anycast Edge| VercelEdge[Vercel Global Edge CDN]
    VercelEdge -->|Serves Static Assets| SPA[React PWA Single Page App]
    VercelEdge -->|Routes /api/*| ServerlessFunc[Vercel Serverless Node.js Functions]

    ServerlessFunc -->|Connection Pooler (Port 6543)| SupabasePgBouncer[Supabase PgBouncer]
    SupabasePgBouncer -->|Direct Transaction| SupabaseDB[(PostgreSQL Managed DB)]

    Cron[GitHub Actions / cron-job.org] -->|Every 10 mins ping| ServerlessFunc
```

---

## 2. Xosting Provayderlari va Bepul Limitlar Tahlili

| Infratuzilma Komponenti | Provayder va Xizmat | Bepul Tarif Cheklovlari (Free Tier Limit) | MicroStore Ishlatish Hajmi | Xarajat |
|---|---|---|---|---|
| **Frontend CDN** | Vercel Starter | 100 GB Bandwidth/oy, Custom Domain | ~5-10 GB / oy | **$0 / oy** |
| **Backend API** | Vercel Serverless | 100,000 Requests/kun, 10s Execution Limit | ~3,000 Requests / kun | **$0 / oy** |
| **PostgreSQL Database** | Supabase Cloud | 500 MB DB Space, 50,000 Active Users | ~120 MB / yil | **$0 / oy** |
| **Telegram Bot Webhook** | Vercel Serverless | Serverless Webhook Endpoint | ~1,000 Webhooks / kun | **$0 / oy** |
| **SSL Sertifikat** | Let's Encrypt / Vercel | Avtomatik va Cheksiz renewal | 100% Avtomatik | **$0 / oy** |

---

## 3. Cold Start va Keep-Alive Cron Ping Mexanizmi

Free Serverless PaaS xizmatlari (Vercel / Supabase) 15 daqiqa davomida so'rov tushmasa "uxlab qolishi" (Cold Start) va so'rov kelganda 1-3 soniyagacha sekinlashishi mumkin. 

MicroStore'ning **"3 soniyalik ultra-fast UX"** va'dasini saqlab qolish uchun avtomatik **Keep-Alive Cron Ping** sozlanadi.

### Cron Ping Sozlamasi (`vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/v1/health/ping",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

### Health Ping API Handler (`/api/v1/health/ping`):

```typescript
import { Request, Response } from 'express';
import { prisma } from '../../db/client';

export async function healthPingController(req: Request, res: Response) {
  try {
    // 1. Bazani uyg'oq ushlash uchun yengil query
    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'MicroStore Core API',
      database: 'CONNECTED'
    });
  } catch (error) {
    return res.status(500).json({ status: 'DOWN', error: String(error) });
  }
}
```

---

## 4. Konfiguratsiya va Muhit O'zgaruvchilari (`.env.example`)

Production va Staging muhiti uchun barcha maxfiy kalitlar `.env` fayli orqali boshqariladi:

```env
# Server Configuration
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://microstore.uz

# Database Configuration (Supabase Connection Pooling)
DATABASE_URL="postgres://postgres.xxxx:password@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgres://postgres.xxxx:password@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"

# JWT Auth Secret
JWT_SECRET="e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0"

# Telegram Bot Integration
TELEGRAM_BOT_TOKEN="7123456789:AAFxxx_YourTelegramBotTokenHere"
TELEGRAM_BOT_WEBHOOK_SECRET="whsec_9876543210_secret_string"
```

---

## 5. Ochiq Savollar (Open Questions)

1. *Agar kelajakda do'konlar soni 1,000 tadan oshib ketsa, Supabase Free Tier-dan Pro Tier-ga ($25/oy) o'tish mexanizmi 1 kunda amalga oshiriladimi?*
2. *Vercel Serverless Functions O'zbekiston hududidagi foydalanuvchilar uchun eng yaqin qaysi datacenter (Frankfurt/Istanbul/Singapore) ga joylashtirilgani ma'qul?*
