# Facebook Post Scheduler - 0đ Pilot

This repo has two modes:

- Local/dev: `node server.mjs`, with `STORAGE_DRIVER=json` allowed for quick testing.
- Pilot deploy: Cloudflare Workers + static assets + Supabase Free/Postgres + Supabase Storage.

The pilot is designed to cost 0đ while you validate with a small number of users. It does not promise SLA, perfect uptime, or 100% protection against hacking. Free tiers have limits and can throttle/stop when exceeded.

Do not use Vercel Hobby for paid customers. The production pilot path in this repo is Cloudflare Workers + Supabase.

## Architecture

- Frontend: static files in `public/`, deployed with Cloudflare Workers assets or Cloudflare Pages.
- API: `worker.mjs` on Cloudflare Workers.
- Database: Supabase Free Postgres.
- Images: Supabase Storage bucket.
- Scheduler: Cloudflare Cron Trigger calling Worker `scheduled()` every 5 minutes.
- Facebook token: Cloudflare Worker secret only.

## Local Dev

```bash
node server.mjs
```

Open `http://localhost:4173`.

Local JSON storage is only for development. Do not use `data/posts.json` for production.

## Supabase Setup

1. Create a free Supabase project.
2. Open SQL Editor.
3. Run [supabase/schema.sql](</d:/codechoi/Tool đăng bài facebook/supabase/schema.sql>).
4. Confirm tables exist:
   - `posts`
   - `audit_logs`
5. Confirm Storage bucket exists:
   - `post-images`

RLS is enabled and no public table policies are created. The frontend must not read/write Supabase directly. Only the Worker uses the service role key.

## Admin Password Hash

Generate a password hash:

```bash
node scripts/hash-password.mjs "your-strong-admin-password"
```

Use the output as `ADMIN_PASSWORD_HASH`.

Never put the plain password in code, GitHub, frontend JavaScript, or public docs.

## Cloudflare Deploy

Install/login Wrangler if needed:

```bash
npx wrangler login
```

Set secrets:

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD_HASH
npx wrangler secret put SESSION_SECRET
npx wrangler secret put CRON_SECRET
npx wrangler secret put FB_PAGE_ACCESS_TOKEN
```

Optional/normal vars are in [wrangler.toml](</d:/codechoi/Tool đăng bài facebook/wrangler.toml>):

```toml
STORAGE_DRIVER = "supabase"
FB_DRY_RUN = "true"
FB_GRAPH_VERSION = "v25.0"
SUPABASE_STORAGE_BUCKET = "post-images"
UPLOAD_MAX_BYTES = "5242880"
```

Deploy:

```bash
npx wrangler deploy
```

For real publish, set:

```bash
npx wrangler secret put FB_PAGE_ID
npx wrangler secret put FB_PAGE_ACCESS_TOKEN
```

Then change `FB_DRY_RUN` to `"false"` in `wrangler.toml` or set it as a secret/var in Cloudflare.

## Cron

`wrangler.toml` includes:

```toml
[triggers]
crons = ["*/5 * * * *"]
```

Manual cron endpoint:

```bash
POST /api/cron/tick
Authorization: Bearer <CRON_SECRET>
```

Admin UI manual tick:

```bash
POST /api/scheduler/tick
```

The admin endpoint requires login + CSRF. The cron endpoint requires `CRON_SECRET`.

## Security Model

- Admin session cookie is `HttpOnly`.
- Cookie is `Secure` in production/HTTPS.
- CSRF token is required for write requests.
- Admin API is not public.
- Facebook Page Access Token is never returned by API.
- Supabase service role key is Worker-only.
- No important data is stored in `localStorage`.
- Uploads go to Supabase Storage, not filesystem.
- SVG/HTML/JS uploads are rejected.
- API responses do not include stack traces.
- Security headers are set by the Worker.

## Security Checklist Before Pilot

- `STORAGE_DRIVER=supabase` in Cloudflare.
- `FB_DRY_RUN=true` for first test.
- `ADMIN_PASSWORD_HASH` generated with `scripts/hash-password.mjs`.
- `SESSION_SECRET` is long and random.
- `CRON_SECRET` is long and random.
- `SUPABASE_SERVICE_ROLE_KEY` is only in Worker secrets.
- Supabase `posts` and `audit_logs` RLS are enabled.
- No Supabase service role key in frontend bundle.
- No Facebook token in frontend bundle, API responses, browser console, or logs.
- Cloudflare Worker URL is HTTPS.
- Test unauthenticated `/api/posts` returns 401.
- Test `/api/cron/tick` without bearer returns 401.
- Test upload rejects SVG and oversized files.
- Rotate token immediately if it was ever pasted into chat, frontend, browser storage, or Git.

## Rotate Keys/Tokens

- Admin lockout: change `ADMIN_PASSWORD_HASH` and rotate `SESSION_SECRET`.
- Cron: rotate `CRON_SECRET`.
- Supabase: rotate service role key in Supabase, then update Worker secret.
- Facebook: create/refresh Page token, then update `FB_PAGE_ACCESS_TOKEN`.

After rotating secrets:

```bash
npx wrangler deploy
```

## Backup/Export

Admin exports:

- `GET /api/export/posts.json`
- `GET /api/export/posts.csv`

Supabase backup options:

- Use Supabase dashboard table export for pilot.
- Use `pg_dump` for a stronger backup workflow when moving beyond pilot.
- Export `audit_logs` before deleting old projects.

## Test Flow

1. Deploy with `FB_DRY_RUN=true`.
2. Log in as admin.
3. Create a text post scheduled a few minutes ahead.
4. Upload a jpg/png/webp image.
5. Confirm refresh keeps posts from Supabase.
6. Trigger `POST /api/scheduler/tick` from the UI.
7. Trigger `/api/cron/tick` with and without `CRON_SECRET`.
8. Switch `FB_DRY_RUN=false` only after dry-run works.
9. Test real Facebook text post.
10. Test real Facebook photo post.

## Common Limits

- Cloudflare Workers Free has request limits; pilot traffic must stay small.
- Supabase Free has database/storage limits.
- Cloudflare Cron is good for pilot scheduling, not a paid SLA.
- Facebook publish requires a valid Page token and permissions such as `pages_manage_posts`.
- Meta App Review may be required depending on how you obtain and use permissions.

## Tests

```bash
node --test
```

`npm test` runs the same command when `npm` is available.
