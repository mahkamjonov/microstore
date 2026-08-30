# 19. Arxitektura Qarorlari Jurnali (Architecture Decision Log - ADR)

## 1. ADR-001: SMS OTP o'rniga Telegram WebApp / Bot Auth Ishlatish

- **Kontekst:** Sotuvchilar ilovaga kirishi va autentifikatsiyadan o'tishi kerak. SMS OTP har bir SMS uchun 150-200 so'm xarajat va yetib borish kechikishlariga ega.
- **Ko'rib Chiqilgan Variantlar:**
  1. SMS OTP (Eskiz.uz / PlayMobile) — Pullik, sekin.
  2. Login / Parol — Sotuvchilar parolni esdan chiqarib qo'yadi.
  3. **Telegram 1-Click Auth (Tanlandi)** — 100% tekin, 1 soniyada avtorizatsiya.
- **Qaror:** Telegram HMAC-SHA256 Auth va Telegram Bot Deep Link orqali 1-click avtorizatsiya tanlandi.
- **Oqibatlar:** Telegram ilovasi yo'q foydalanuvchilar qamralmasligi mumkin (O'zbekistonda 95%+ Telegram ishlatadi).
- **Qayta Ko'riladi:** Agar Telegram ilovasi sekinlashsa yoki bloklansa 2-bosqichda SMS zaxirasi qo'shiladi.

---

## 2. ADR-002: Hard Delete o'rniga Soft Delete va Immutable Audit Trail

- **Kontekst:** Sotuvchilar va do'kon egalari o meida moliyaviy ma'lumotlar o'zgartirilishi bo'yicha kelishmovchiliklar kelib chiqishi mumkin.
- **Ko'rib Chiqilgan Variantlar:**
  1. Direct SQL `DELETE` & `UPDATE` — Eski ma'lumot yo'qoladi, audit imkonsiz.
  2. **Soft Delete (`is_archived`) & JSONB Audit Log (Tanlandi)** — To'liq shaffoflik.
- **Qaror:** Bazada yozuvlar hech qachon o'chirilmaydi. Har bir tahrir `audit_logs` jadvalida saqlanadi.
- **Oqibatlar:** Database hajmi biroz tezroq o'sadi, lekin 500MB sig'im 3.5 yilga yetadi.

---

## 3. ADR-003: Client-Side UUID orqali Idempotent Offline Sync

- **Kontekst:** Offline rejimda kiritilgan tushumlar internet kelganida 2 marta bazaga yuborilib duplikasiya yaratishi mumkin.
- **Ko'rib Chiqilgan Variantlar:**
  1. Server Timestamp check — Vaqt farqi tufayli ishonchsiz.
  2. **Client UUID Generator (`X-Client-Tx-ID`) (Tanlandi)** — 100% unikal idempotency.
- **Qaror:** Har bir offline yozuv brauzerda v4 UUID oladi va header orqali yuboriladi.

---

## 4. ADR-004: VPS Docker o'rniga Vercel Serverless + Supabase

- **Kontekst:** 4-5 kunlik deadline va $0 oylik infratuzilma byudjeti talabi.
- **Ko'rib Chiqilgan Variantlar:**
  1. Hetzner VPS + Docker Compose — DevOps sozlash 1-2 kun oladi, $5/oy.
  2. **Vercel Serverless + Supabase (Tanlandi)** — 0$-oylik, Zero-devops setup.

---

## 5. Ochiq Savollar (Open Questions)

1. *ADR-001 bo'yicha Telegram WebApp o'rniga Telegram Mini App (TMA) formatiga to'liq o'tish zarurmi?*
