# Loyihani boshlash

Bu loyihani ishlab chiqishni boshlash uchun quyidagi promptni Claude Code'ga (yoki boshqa AI agentga) tashlang:

```text
Men MicroStore (Mahalliy Sotuvchilar uchun Kundalik Tushum va Qarzlar Hisobi) loyihasini amalga oshirmoqchiman. 

Barcha arxitektura hujjatlari, ma'lumotlar bazasi modeli (Prisma schema), API dizayni va UI/UX spetsifikatsiyalari `docs/architecture/` papkasida to'liq tayyorlangan:
- Boshlash va ko'rib chiqish uchun: docs/architecture/README.md
- Yagona master hujjat: docs/architecture/ARCHITECTURE-FULL.md
- Ma'lumotlar modeli va Prisma schema: docs/architecture/05-data-model.md
- API va Controllerlar: docs/architecture/06-api-design.md
- 1-Page Sotuvchi UI kodi va PWA logic: docs/architecture/09-frontend-architecture.md
- Yo'l xaritasi va granulyar vazifalar: docs/architecture/16-roadmap-and-phases.md

Vazifang:
1. `docs/architecture/16-roadmap-and-phases.md` faylidagi Faza 0 (Skelet) va Faza 1 (MVP) vazifalarini ketma-ketlikda bajarish.
2. Dastlab monorepo strukturasi (`apps/web`, `apps/api`, `packages/database`), React 18 PWA frontend, Node.js TypeScript Express backend hamda Supabase Prisma schema-ni sozla.
3. Keyin 1-Page Sotuvchi UI (Sticky DateSelector, Naqd/Terminal/Xolis inputlari, Auto Total va Ta'minotchilar +/- qarz modallari) komponentlarini qur.
4. Telegram Auth (1-Click Login) va Offline LocalStorage Sync Queue mexanizmlarini ishga tushir.
5. Har bir bosqichdan so'ng unit va E2E testlarni yurgazib, kodni tekshir.
```
