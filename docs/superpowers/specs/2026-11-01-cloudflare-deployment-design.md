# Deploy MarLynk ke Cloudflare Workers — Design Spec

**Tanggal:** 2026-11-01
**Domain target:** `marlynk.ammararief.my.id`
**Status:** Menunggu review

---

## 1. Tujuan

Memindahkan MarLynk dari Vercel ke Cloudflare Workers dengan **semua fitur berfungsi**, di domain `marlynk.ammararief.my.id`, tanpa mengganti backend data.

**Kriteria sukses:**

1. `https://marlynk.ammararief.my.id` menyajikan aplikasi.
2. Short link bisa dibuat, di-redirect, dan counter klik bertambah di DB.
3. Login GitHub dan Google berfungsi.
4. Edit/hapus link, QR code, dan copy link berfungsi.
5. Cron pembersihan link kedaluwarsa berjalan harian.
6. Tidak ada regresi perilaku dibanding deployment Vercel.

**Di luar lingkup:** perubahan UI/desain, perubahan skema database, penambahan provider OAuth baru.

---

## 2. Kondisi awal (terverifikasi)

| Aspek | Kondisi |
|---|---|
| Framework | Next.js `14.2.0-canary.12`, App Router, Server Actions, middleware |
| Database | Turso via `@libsql/client/web` — HTTP-based |
| Cache | Upstash Redis REST — HTTP-based |
| Auth | NextAuth v4 + `@auth/drizzle-adapter`, GitHub + Google |
| Cron | `vercel.json` → `GET /api/cron` harian |
| DNS | Zona `ammararief.my.id` aktif; apex dipakai Worker `marfolio` |
| R2 | Belum aktif di akun (API: *"Please enable R2 through the Cloudflare Dashboard"*) |
| Wrangler CLI | Login sebagai `marmdhn28@gmail.com`, scope `workers:write`, `workers_kv:write` |
| PPR | Flag aktif di config, tetapi **tidak satu pun route memakai `experimental_ppr`** |
| `next/image` | Satu pemakaian: favicon 16px dari `t3.gstatic.com` |

Karena database dan cache sudah HTTP-based, migrasi tidak memerlukan penggantian backend.

---

## 3. Keputusan arsitektur

### 3.1 Adapter: OpenNext

Dipilih `@opennextjs/cloudflare@1.15.x`.

Alasan:
- Ini **versi terakhir yang mendukung Next 14** (peer dependency `next: ^14.2.35`). Versi 1.16+ mensyaratkan Next 15/16.
- Fitur yang dipakai app ini semuanya berstatus *Supported*: App Router, Server Actions, Route Handlers, middleware, response streaming.
- `vinext` (rekomendasi Cloudflare untuk proyek baru) hanya mendukung Next 15/16 — tidak berlaku.
- `@cloudflare/next-on-pages` sudah legacy dan memaksa seluruh route ke Edge runtime.

### 3.2 Tanpa cache layer

Dokumentasi OpenNext: *"SSR route will work out of the box without any caching config."*

Seluruh halaman app ini dynamic SSR (`cookies()` di `LinkList` dan `UserProfile`). Tidak ada route yang memakai `experimental_ppr`, ISR, atau `revalidateTag`. Maka:

- Tidak perlu R2, D1, Durable Objects, atau Queue.
- `open-next.config.ts` cukup `defineCloudflareConfig()` tanpa opsi.

Ini juga menghindari ketergantungan pada R2 yang belum aktif di akun.

### 3.3 Upgrade Next ke 14.2.35

Dua alasan independen:
1. Syarat peer dependency OpenNext 1.15.
2. Menutup **CVE-2025-29927** — auth bypass melalui header `x-middleware-subrequest`. Relevan tinggi karena app ini bergantung pada middleware untuk redirect slug.

### 3.4 Cron via Cron Trigger + custom worker

`vercel.json` dihapus. OpenNext hanya meng-export `fetch` handler, jadi cron memerlukan custom worker yang menambahkan `scheduled`.

`scheduled()` memanggil route `/api/cron` yang sudah ada **secara in-process** (memanggil `handler.fetch` langsung, bukan HTTP keluar), dengan header `Authorization: Bearer ${CRON_SECRET}`. Dengan begitu tidak ada round-trip jaringan dan tidak ada risiko loop.

### 3.5 Gambaran alur

```
Browser ──► marlynk.ammararief.my.id (Cloudflare proxy)
                │
                ▼
         Worker "marlynk" (OpenNext / Next.js 14.2.35)
           ├─ middleware  /{slug} → redirect + klik++
           ├─ Server Actions  create / edit / delete
           ├─ NextAuth  GitHub + Google
           └─ /api/cron  ◄── Cron Trigger "0 0 * * *"
                │
                ├──► Turso  (HTTP)
                └──► Upstash Redis (REST)
```

---

## 4. Perubahan file

| File | Perubahan |
|---|---|
| `package.json` | `next` → `14.2.35`; tambah `@opennextjs/cloudflare@1.15.0` (dev), `wrangler` (dev); script `preview`, `deploy`, `cf-typegen` |
| `next.config.js` | Hapus `experimental.ppr`; `images.unoptimized: true`; tambah `initOpenNextCloudflareForDev()` |
| `src/app/layout.tsx` | Hapus import dan pemakaian `<Analytics />` dari `@vercel/analytics` |
| `wrangler.jsonc` *(baru)* | `main: ./custom-worker.ts`, `compatibility_flags: ["nodejs_compat"]`, `assets`, `custom_domain`, `triggers.crons` |
| `open-next.config.ts` *(baru)* | `export default defineCloudflareConfig()` |
| `custom-worker.ts` *(baru)* | Re-export `fetch`; tambah `scheduled()` |
| `vercel.json` | Dihapus |
| `.gitignore` | Tambah `.open-next/`, `.wrangler/`, `.dev.vars*`, `cloudflare-env.d.ts` |
| `.env.example` | `NEXTAUTH_URL` dan `DOMAIN_URL` → domain baru |

### 4.1 Alasan tiap perubahan

**Hapus `experimental.ppr`** — flag ini tidak berpengaruh karena tidak ada route yang mengaktifkan PPR secara eksplisit. Menghapusnya tidak mengubah perilaku; mempertahankannya hanya menambah risiko build pada runtime Worker.

**`images.unoptimized`** — hanya ada satu `<Image>` berukuran 16px (favicon). Image Optimization Cloudflare berbayar per transformasi unik. Tidak sepadan.

**Hapus `@vercel/analytics`** — komponen ini mengirim data ke endpoint Vercel dan tidak berfungsi di luar Vercel. Jika analytics diinginkan, Cloudflare Web Analytics dapat diaktifkan dari dashboard tanpa perubahan kode.

---

## 5. Konfigurasi rahasia

Dipasang sebagai **Worker secret** (bukan `vars`, karena sensitif):

```
TURSO_URL
TURSO_AUTH_TOKEN
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
NEXTAUTH_SECRET
GITHUB_ID
GITHUB_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
CRON_SECRET
```

Dipasang sebagai `vars` (non-rahasia):

```
NEXTAUTH_URL   = https://marlynk.ammararief.my.id
DOMAIN_URL     = https://marlynk.ammararief.my.id
NODE_ENV       = production
```

`DOMAIN_URL` dipakai `getBaseUrl()` untuk menampilkan URL pendek di UI. `NEXTAUTH_URL` dipakai NextAuth v4 untuk membangun callback URL.

Nilai secret dibaca dari `.env` lokal dan dikirim ke Wrangler lewat stdin — tidak ditampilkan di terminal maupun di respons.

---

## 6. Domain dan OAuth

### 6.1 DNS

`wrangler deploy` dengan `custom_domain: true` membuat record DNS dan sertifikat TLS secara otomatis. Bila token OAuth Wrangler tidak memiliki izin zona, fallback: record CNAME `marlynk` ditambahkan manual dari dashboard.

### 6.2 OAuth (dikerjakan pengguna)

Saya tidak memiliki akses ke konsol GitHub/Google. Nilai yang harus diisi:

| Provider | Field | Nilai |
|---|---|---|
| GitHub | Authorization callback URL | `https://marlynk.ammararief.my.id/api/auth/callback/github` |
| Google | Authorized redirect URI | `https://marlynk.ammararief.my.id/api/auth/callback/google` |

Login tidak akan berfungsi sampai kedua nilai ini diperbarui. Deployment tetap bisa diselesaikan lebih dulu.

---

## 7. Perbaikan bug: filter 1 hari

### 7.1 Masalah

`getLinksByUserLinkId()` di `src/server/api/link.ts` selalu membatasi query ke `createdAt >= 1 hari lalu`.

Fungsi ini dipakai di dua tempat dengan kebutuhan berbeda:

| Pemanggil | Kebutuhan sebenarnya |
|---|---|
| `src/components/links/link-list.tsx` (tampilan guest) | Batas 24 jam **benar** — link guest memang kedaluwarsa setelah 24 jam (`GUEST_LINK_EXPIRE_TIME`, dihapus cron) |
| `src/server/auth.ts` (migrasi saat sign-in) | Batas 24 jam **salah** — link guest berumur lebih dari 24 jam tidak ikut dipindahkan ke akun, lalu hilang permanen |

Akibatnya: guest yang membuat link, menunggu lebih dari sehari, lalu mendaftar, kehilangan link-nya meskipun barisnya masih ada di database.

Filter juga menyertakan batas atas `lte(createdAt, now)` yang tidak berguna — `now` selalu lebih besar dari `createdAt`.

### 7.2 Perbaikan

Ubah filter menjadi **opt-in per pemanggil**, bukan perilaku default:

```ts
export async function getLinksByUserLinkId(
  userLinkId: string,
  options: { createdAfter?: Date } = {},
): Promise<ShortLink[]> {
  const where = options.createdAfter
    ? and(
        eq(links.userLinkId, userLinkId),
        gte(links.createdAt, options.createdAfter),
      )
    : eq(links.userLinkId, userLinkId);

  return db.query.links.findMany({
    where,
    orderBy: desc(links.createdAt),
  });
}
```

Pemanggil di `link-list.tsx` meneruskan batas waktu secara eksplisit:

```ts
const createdAfter = new Date(Date.now() - GUEST_LINK_EXPIRE_TIME * 1000);
return await getLinksByUserLinkId(userLinkIdCookie, { createdAfter });
```

Pemanggil di `auth.ts` tidak meneruskan opsi apa pun, sehingga seluruh link guest ikut dimigrasikan.

### 7.3 Yang tidak berubah

- Tampilan guest tetap dibatasi 24 jam — perilaku ini benar dan dipertahankan.
- Path user login (`getUserLinkByUserId`) sudah tidak memfilter; tidak disentuh.
- Cron dan `GUEST_LINK_EXPIRE_TIME` tidak berubah.

---

## 8. Verifikasi

Dijalankan berurutan; setiap langkah harus lulus sebelum lanjut.

**Build:**
1. `pnpm install`
2. `pnpm build` — Next.js build dengan versi baru
3. `pnpm exec opennextjs-cloudflare build` — build Worker

**Deploy:**
4. Pasang secrets dan vars
5. `pnpm deploy`

**Uji fungsional di domain produksi:**

| # | Skenario | Kriteria lulus |
|---|---|---|
| 1 | Buka beranda | Halaman render, tanpa error runtime |
| 2 | Buat short link sebagai guest | Link muncul di daftar |
| 3 | Buka `/{slug}` | Redirect ke URL tujuan |
| 4 | Ulangi #3, cek DB | Kolom `clicks` bertambah |
| 5 | Login GitHub | Sesi terbentuk, link guest ikut pindah |
| 6 | Login Google | Sesi terbentuk |
| 7 | Edit slug dan URL | Perubahan tersimpan dan redirect ikut berubah |
| 8 | Hapus link | Link hilang dari daftar dan Redis |
| 9 | QR code | Ter-render |
| 10 | Cron | `scheduled()` memanggil `/api/cron`, link kedaluwarsa terhapus |
| 11 | Bug 1 hari | Link guest berumur >24 jam tetap ikut dimigrasikan saat sign-in |

---

## 9. Risiko

| # | Risiko | Dampak | Mitigasi |
|---|---|---|---|
| 1 | Drizzle + `@libsql/client/web` di bundle middleware | Build/deploy gagal atau middleware error | Uji di langkah 3–4. Bila gagal: pindahkan lookup redirect dari middleware ke route handler `/[slug]` (perubahan lebih besar, akan dibahas terpisah) |
| 2 | `process.env` tidak terisi saat module init `src/env.js` | Aplikasi gagal start karena validasi env | Uji dengan request nyata. Bila gagal: gunakan `SKIP_ENV_VALIDATION` saat build dan pastikan runtime membaca dari Worker env |
| 3 | `revalidatePath("/")` tanpa tag cache | Error saat Server Action | Halaman sepenuhnya dynamic sehingga seharusnya no-op. Bila error, hapus pemanggilan — tidak ada efek fungsional yang hilang |
| 4 | Token Wrangler tanpa izin zona | Custom domain tidak terbuat otomatis | Tambahkan CNAME manual dari dashboard |
| 5 | Middleware memanggil Turso di setiap request | Latensi tambahan per redirect | Di luar lingkup; sudah ada Redis cache. Dicatat untuk optimasi terpisah |

---

## 10. Catatan di luar lingkup

Ditemukan saat analisis, **tidak diperbaiki** dalam pekerjaan ini:

1. **`LinkForm` tidak pernah menampilkan URL hasil.** `createShortLink` dipanggil dengan `slug: ""`, sehingga state `created` tidak pernah terisi dan blok "Dismiss / copy" tidak pernah muncul. Pengguna hanya mendapat toast.
2. **`db = drizzle(client, { logger: true })`** aktif di produksi — setiap query dicatat ke log Worker.
3. **Analytics hilang** setelah `@vercel/analytics` dilepas. Bisa digantikan Cloudflare Web Analytics dari dashboard tanpa perubahan kode.

Ketiganya dapat dikerjakan terpisah bila diinginkan.
