# 05. Ma'lumotlar Modeli (Data Model & Database Schema)

## 1. To'liq ER Diagramma (Entity Relationship Diagram)

MicroStore ma'lumotlar bazasi **PostgreSQL** boshqaruvida ishlaydi. Ma'lumotlar butunligi va shaffofligini ta'minlash uchun har bir relatsiya va audit loglar o meidagi bog'liqliklar qat'iy belgilangan.

```mermaid
erDiagram
    STORES ||--o{ USERS : "owns"
    STORES ||--o{ DAILY_REVENUES : "records"
    STORES ||--o{ SUPPLIERS : "has"
    SUPPLIERS ||--o{ SUPPLIER_TRANSACTIONS : "logs"
    STORES ||--o{ AUDIT_LOGS : "tracks"

    STORES {
        uuid id PK
        string name
        string phone
        timestamp created_at
        boolean is_active
    }

    USERS {
        uuid id PK
        uuid store_id FK
        bigint telegram_id UK
        string first_name
        string username
        timestamp created_at
    }

    DAILY_REVENUES {
        uuid id PK
        uuid store_id FK
        date entry_date UK_store_date
        decimal cash_amount
        decimal terminal_amount
        decimal xolis_amount
        decimal total_amount
        boolean is_archived
        uuid client_tx_id UK
        timestamp updated_at
    }

    SUPPLIERS {
        uuid id PK
        uuid store_id FK
        string name
        decimal current_balance
        boolean is_archived
        timestamp created_at
    }

    SUPPLIER_TRANSACTIONS {
        uuid id PK
        uuid supplier_id FK
        string type "INCREASE_DEBT / DECREASE_DEBT"
        decimal amount
        string note
        boolean is_archived
        uuid client_tx_id UK
        timestamp created_at
    }

    AUDIT_LOGS {
        uuid id PK
        uuid store_id FK
        uuid user_id FK
        string entity_name "DAILY_REVENUE / SUPPLIER / DEBT"
        uuid entity_id
        string action "CREATE / UPDATE / SOFT_DELETE"
        jsonb old_values
        jsonb new_values
        timestamp created_at
    }
```

---

## 2. PostgreSQL Jadvallari va Indekslari

### 1. `stores` (Do'konlar)
| Ustun Nomi | Ma'lumot Turi | Cheklovlar | Izoh |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unikal do'kon IDsi |
| `name` | `VARCHAR(100)` | `NOT NULL` | Do'kon nomi (masalan: "Oazis Supermarket") |
| `phone` | `VARCHAR(20)` | `NULLABLE` | Bog'lanish telefoni |
| `is_active` | `BOOLEAN` | `NOT NULL, DEFAULT true` | Do'kon faolligi |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Yaratilgan vaqti |

### 2. `daily_revenues` (Kunlik Tushumlar)
| Ustun Nomi | Ma'lumot Turi | Cheklovlar | Izoh |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Unikal yozuv IDsi |
| `store_id` | `UUID` | `NOT NULL, REFERENCES stores(id)` | Do'kon IDsi |
| `entry_date` | `DATE` | `NOT NULL` | Tushum sanasi (masalan: `2026-08-29`) |
| `cash_amount` | `NUMERIC(14,2)`| `NOT NULL, DEFAULT 0.00` | Naqd pul tushumi |
| `terminal_amount`| `NUMERIC(14,2)`| `NOT NULL, DEFAULT 0.00` | Terminal tushumi |
| `xolis_amount` | `NUMERIC(14,2)`| `NOT NULL, DEFAULT 0.00` | Xolis/Foyda summasi |
| `total_amount` | `NUMERIC(14,2)`| `NOT NULL` | Auto-calculated `(Naqd+Term+Xolis)` |
| `client_tx_id` | `UUID` | `UNIQUE, NULLABLE` | Offline Idempotency UUID |
| `is_archived` | `BOOLEAN` | `NOT NULL, DEFAULT false` | Soft delete bayrog'i |

*Indekslar:* `CREATE UNIQUE INDEX idx_store_entry_date ON daily_revenues(store_id, entry_date) WHERE is_archived = false;`

### 3. `suppliers` va `supplier_transactions`
`supplier_transactions` ta'minotchi qarzining oshishi (`INCREASE_DEBT` — tovar keldi) va kamayishini (`DECREASE_DEBT` — pul berildi) aniq qayd etadi.

---

## 3. Production Prisma Schema (`schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum TransactionType {
  INCREASE_DEBT // (+) Qarz oshdi (tovar keldi)
  DECREASE_DEBT // (-) Qarz uzildi (pul berildi)
}

enum AuditAction {
  CREATE
  UPDATE
  SOFT_DELETE
}

model Store {
  id         String   @id @default(uuid()) @db.Uuid
  name       String   @db.VarChar(100)
  phone      String?  @db.VarChar(20)
  isActive   Boolean  @default(true) @map("is_active")
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz

  users                User[]
  dailyRevenues        DailyRevenue[]
  suppliers            Supplier[]
  auditLogs            AuditLog[]

  @@map("stores")
}

model User {
  id          String   @id @default(uuid()) @db.Uuid
  storeId     String   @map("store_id") @db.Uuid
  telegramId  BigInt   @unique @map("telegram_id")
  firstName   String   @map("first_name") @db.VarChar(100)
  username    String?  @db.VarChar(100)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz

  store       Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  auditLogs   AuditLog[]

  @@map("users")
}

model DailyRevenue {
  id             String   @id @default(uuid()) @db.Uuid
  storeId        String   @map("store_id") @db.Uuid
  entryDate      DateTime @map("entry_date") @db.Date
  cashAmount     Decimal  @default(0.00) @map("cash_amount") @db.Decimal(14, 2)
  terminalAmount Decimal  @default(0.00) @map("terminal_amount") @db.Decimal(14, 2)
  xolisAmount    Decimal  @default(0.00) @map("xolis_amount") @db.Decimal(14, 2)
  totalAmount    Decimal  @map("total_amount") @db.Decimal(14, 2)
  clientTxId     String?  @unique @map("client_tx_id") @db.Uuid
  isArchived     Boolean  @default(false) @map("is_archived")
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz

  store          Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@unique([storeId, entryDate], map: "unique_store_entry_date")
  @@index([storeId, entryDate])
  @@map("daily_revenues")
}

model Supplier {
  id             String   @id @default(uuid()) @db.Uuid
  storeId        String   @map("store_id") @db.Uuid
  name           String   @db.VarChar(100)
  currentBalance Decimal  @default(0.00) @map("current_balance") @db.Decimal(14, 2)
  isArchived     Boolean  @default(false) @map("is_archived")
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz

  store          Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  transactions   SupplierTransaction[]

  @@map("suppliers")
}

model SupplierTransaction {
  id          String          @id @default(uuid()) @db.Uuid
  supplierId  String          @map("supplier_id") @db.Uuid
  type        TransactionType
  amount      Decimal         @db.Decimal(14, 2)
  note        String?         @db.VarChar(255)
  clientTxId  String?         @unique @map("client_tx_id") @db.Uuid
  isArchived  Boolean         @default(false) @map("is_archived")
  createdAt   DateTime        @default(now()) @map("created_at") @db.Timestamptz

  supplier    Supplier        @relation(fields: [supplierId], references: [id], onDelete: Cascade)

  @@index([supplierId, createdAt])
  @@map("supplier_transactions")
}

model AuditLog {
  id         String      @id @default(uuid()) @db.Uuid
  storeId    String      @map("store_id") @db.Uuid
  userId     String?     @map("user_id") @db.Uuid
  entityName String      @map("entity_name") @db.VarChar(50)
  entityId   String      @map("entity_id") @db.Uuid
  action     AuditAction
  oldValues  Json?       @map("old_values")
  newValues  Json?       @map("new_values")
  createdAt  DateTime    @default(now()) @map("created_at") @db.Timestamptz

  store      Store       @relation(fields: [storeId], references: [id], onDelete: Cascade)
  user       User?       @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([storeId, createdAt])
  @@map("audit_logs")
}
```

---

## 4. O'sish Prognozi va Bazani Arxivlash Rejasi

### Hajm Hisob-Kitobi (Storage Calculation):
- 200 ta do'kon × 365 kun = **73,000 kunlik tushum yozuvi/yil**.
- 200 ta do'kon × 5 ta ta'minotchi × 100 tranzaksiya = **100,000 qarz yozuvi/yil**.
- Audit loglar = **~200,000 log/yil**.
- Bir yillik xotira hajmi: **~120 MB / yil**.
- **Xulosa:** Supabase Free Tier 500MB sig'imi 200 ta do'kon uchun **kamida 3.5 – 4 yilga 100% bepul yetadi**.

---

## 5. Ochiq Savollar (Open Questions)

1. *Audit loglar hajmi kattalashgan sari eskirgan audit yozuvlarini 1 yildan keyin cold storage'ga (JSON file export) ko'chirish shartmi?*
2. *Decimal(14, 2) aniqligi valyuta inflyatsiyasi holatida 999 milliard so'mgacha yetadi. Bu diapazon yetarlimi?*
