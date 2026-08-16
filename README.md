# Winnie & Co Dog Grooming

Booking + invoicing website for Winnie & Co, a mobile dog grooming business in Berwick, VIC.

Customers book a grooming slot (which the owner approves); the system auto-generates a draft invoice from the booking, the owner edits it, and sends it by email. Payments are handled offline — the invoice carries the owner's bank details.

## Stack

- **Astro 7** (SSR) + `@astrojs/vercel`
- **Neon Postgres** (or any Postgres) + **Drizzle ORM**
- **Resend** for transactional email
- Tailwind CSS v4

## Local development

```bash
# 1. Start the database
docker compose up -d

# 2. Install deps
npm install

# 3. Configure env (see .env.example)
cp .env.example .env
#   set ADMIN_PASSWORD, ADMIN_SECRET; DATABASE_URL defaults to local docker

# 4. Create schema + seed
npm run db:generate
npm run db:migrate
npm run db:seed

# 5. Run
npm run dev        # http://localhost:4321
```

Admin login: `/admin` (password from `ADMIN_PASSWORD`).

### Checks

```bash
npm run check                # typecheck
npx tsx src/lib/availability.check.ts   # availability engine self-check
```

## Deploy to Vercel

1. Create a **Neon** project → copy the **pooled** connection string.
2. Push to GitHub, import the repo in Vercel.
3. Set env vars in Vercel:
   - `DATABASE_URL` — Neon pooled URL (e.g. `postgres://...-pooler.region.aws.neon.tech/winnie?sslmode=require`)
   - `ADMIN_PASSWORD` — a strong password for `/admin`
   - `ADMIN_SECRET` — a long random string (signs session cookies)
   - `RESEND_API_KEY` — from Resend; email is skipped without it
   - `EMAIL_FROM` — your verified Resend sender (e.g. `Winnie & Co <bookings@winnieandcodoggrooming.com.au>`)
   - `OWNER_EMAIL` — where new-booking alerts go (e.g. `alisha@winnieandcodoggrooming.com.au`)
   - `PUBLIC_SITE_URL` — your production URL (used in emails)
4. Run migrations against the Neon DB: set `DATABASE_URL` locally to the Neon URL, then `npm run db:migrate`, then `npm run db:seed`.

> `db:seed` fills in services, add-ons and working hours. Re-run it on an empty DB only. The biweekly-Saturday anchor and bank details are editable in `/admin`.

## Features

- **Booking wizard** — service → size → day → free slot → dog/contact details. Slots respect working hours, the biweekly Saturday rule, blockouts, and existing bookings.
- **Owner approval** — bookings land `pending`; the owner approves/declines from `/admin`. Approved bookings get a confirmation email.
- **Invoices** — auto-generated as a draft from each booking (service price + add-ons + travel line), editable line-by-line in `/admin/invoices/[id]`, sent to the customer as a link to a printable page. Statuses: draft → sent → paid.
- **Availability admin** — weekly hours, biweekly Saturday anchor, and one-off day/time blocks.
- **Email** — request-received, new-booking alert, confirmed, declined, invoice-sent.

## Data model

`services` (with per-size prices + durations) · `addons` · `working_hours` · `blockouts` · `bookings` · `invoices` · `invoice_items` · `settings`.

Double-booking is prevented by a partial unique index on live bookings' `slot_start` plus a server-side overlap re-check (`ponytail:` — a cross-overlap race window is possible under exact simultaneity; upgrade path is a serializable transaction or a GiST exclusion constraint).
