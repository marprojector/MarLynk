<img width="1710" height="994" alt="Screenshot 2026-08-26 at 01 41 31" src="https://github.com/user-attachments/assets/b4583d63-7d6d-40c0-8436-56feddec1cf6" />


# MarLynk

> Short links, smarter sharing.

**MarLynk** is an open-source URL shortener and QR code generator built with the
Next.js App Router. Paste any URL and get a clean, shareable `marlynk` link with
a scannable QR code — instantly. Links can be created as a guest or tied to your
account via GitHub / Google sign-in.

🌐 Live demo: [marlynk.vercel.app](https://marlynk.vercel.app)

---

## ✨ Features

- **URL shortening** — create short links with a custom slug and optional description.
- **QR code generation** — generate and download a scannable QR code for every link.
- **Guest mode** — shorten links without an account. A `user-link-id` cookie tracks
  your session, and your links are persisted to your account automatically when you sign in.
- **OAuth authentication** — sign in with **GitHub** or **Google** via NextAuth.js.
- **Link management** — copy to clipboard, edit, delete, and view link options from a
  dropdown menu.
- **Click tracking** — each short link records the number of times it has been visited.
- **Guest link expiration** — guest links expire after 24 hours (managed with Redis)
  and are cleaned up by a scheduled cron job.
- **Dark / light theme** — toggle between themes with `next-themes`.
- **Analytics** — privacy-friendly usage analytics via Vercel Analytics.

---

## 🧱 Tech Stack

| Category        | Technology                                                        |
| --------------- | ----------------------------------------------------------------- |
| Framework       | [Next.js 14](https://nextjs.org/) (App Router, TypeScript)        |
| Styling         | [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (Radix UI) |
| Database        | [Drizzle ORM](https://orm.drizzle.team/) + [Turso (libSQL)](https://turso.tech/) (SQLite) |
| Auth            | [NextAuth.js v4](https://next-auth.js.org/) (GitHub & Google)     |
| Cache / Rate    | [Upstash Redis](https://upstash.com/)                             |
| Server Actions  | [next-safe-action](https://next-safe-action.ecnt.io/) + [Zod](https://zod.dev/) |
| Package Manager | [pnpm](https://pnpm.io/)                                          |
| Hosting         | [Vercel](https://vercel.com/)                                     |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/installation)
- A [Turso](https://turso.tech/) database
- An [Upstash Redis](https://upstash.com/) instance
- GitHub & Google OAuth app credentials
- A `CRON_SECRET` for the cleanup job

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/marprojector/MarLynk.git
   cd MarLynk
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   Copy the example file and fill in your values:

   ```bash
   cp .env.example .env
   ```

   | Variable                      | Description                                      |
   | ----------------------------- | ------------------------------------------------ |
   | `TURSO_URL`                   | Turso/libSQL database URL                        |
   | `TURSO_AUTH_TOKEN`            | Turso auth token                                |
   | `UPSTASH_REDIS_REST_URL`      | Upstash Redis REST URL                           |
   | `UPSTASH_REDIS_REST_TOKEN`    | Upstash Redis REST token                         |
   | `NEXTAUTH_URL`                | `http://localhost:3000` in dev                   |
   | `NEXTAUTH_SECRET`             | Session secret (`openssl rand -base64 32`)       |
   | `GITHUB_ID` / `GITHUB_SECRET` | GitHub OAuth credentials                         |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials       |
   | `DOMAIN_URL`                  | Public domain (e.g. `https://marlynk.vercel.app`) |
   | `CRON_SECRET`                 | Secret used to authorize the cron cleanup route  |

4. **Push the database schema**

   ```bash
   pnpm db:push
   ```

5. **Run the development server**

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

---

## 📜 Available Scripts

| Script             | Description                                  |
| ------------------ | -------------------------------------------- |
| `pnpm dev`         | Start the Next.js dev server                 |
| `pnpm build`       | Build the production app                     |
| `pnpm start`       | Start the production server                  |
| `pnpm lint`        | Run ESLint                                   |
| `pnpm db:generate` | Generate Drizzle migrations (SQLite)         |
| `pnpm db:push`     | Push schema changes to the database          |
| `pnpm db:pull`     | Introspect the database                       |
| `pnpm db:studio`   | Open Drizzle Studio                          |

---

## 🗂️ Project Structure

```
src/
├── app/                 # App Router routes & API routes (auth, cron)
├── components/          # UI components (links, auth, layout, ui)
├── hooks/               # Custom React hooks
├── lib/                 # Utilities, config & validations
├── server/              # Server actions, API, auth, db, redis
│   ├── actions/         # next-safe-action server actions
│   ├── api/             # Data-access layer
│   └── db/              # Drizzle schema & client
├── styles/              # Global styles
└── types/               # Shared types
```

---

## ☁️ Deployment

MarLynk is configured for [Vercel](https://vercel.com/).

1. Import the repository into Vercel.
2. Set all the environment variables listed above (use your production
   `NEXTAUTH_URL` and `DOMAIN_URL`).
3. Deploy — the `vercel.json` and GitHub Actions workflow handle the rest.

To keep guest links from growing unbounded, configure a scheduled cron job that
calls the `/api/cron` route authenticated with your `CRON_SECRET`.

---

## 📄 License

Distributed under the [MIT License](LICENSE).

