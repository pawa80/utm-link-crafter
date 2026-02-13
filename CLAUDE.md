# UTM Link Crafter

## What This Is
Full SaaS app for digital marketers to create, manage, and organise UTM tracking links for campaigns. Built on Replit ~mid 2025, migrated to GitHub/Vercel Feb 2026.

## Live URL
https://utm-link-crafter-jg3g.vercel.app

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind + shadcn/ui (Radix)
- **Backend**: Express.js + TypeScript (serverless on Vercel)
- **Database**: PostgreSQL via Neon serverless, Drizzle ORM
- **Auth**: Firebase (`utmlinkcrafter-replitnew`), Google sign-in + email/password
- **Email**: Resend (optional, for invitations)
- **Hosting**: Vercel

## Architecture
- `npm run build:vercel` → Vite builds frontend to `dist/public/`, esbuild bundles server to `api/index.mjs`
- Vercel serves `dist/public/` as static, `api/index.mjs` as serverless function
- Rewrites: `/api/*` → function, everything else → `index.html` (SPA)
- Database schema managed by Drizzle, pushed via `drizzle-kit push`

## Key Directories
- `client/src/` — React frontend (pages, components, hooks, lib)
- `server/` — Express backend (routes.ts is the main API, storage.ts is the DB layer)
- `shared/` — Schema (Drizzle) and validation (Zod), shared between client and server
- `api/` — Pre-bundled serverless function (build artifact, committed to git)
- `migrations/` — Drizzle SQL migrations

## Environment Variables (Vercel)
- `DATABASE_URL` — Neon PostgreSQL connection string
- `VITE_FIREBASE_API_KEY` — `AIzaSyAmj4Fvx5sUy4pAWIaLDoMOfJJsMJhDUcw`
- `VITE_FIREBASE_PROJECT_ID` — `utmlinkcrafter-replitnew`
- `VITE_FIREBASE_APP_ID` — `1:40657725142:web:3ac01b770d235eb1e38b77`
- `RESEND_API_KEY` — optional, for email invitations

## Important Conventions
- **Imports**: All server-side imports MUST use relative paths with `.js` extensions (e.g., `from "../shared/schema.js"`). Do NOT use `@shared/*` path aliases — Vercel cannot resolve them.
- **Native modules**: Do NOT use native Node.js modules (like `bcrypt`). Use pure JS alternatives (like `bcryptjs`). Vercel serverless doesn't support native compilation.
- **After changing server code**: Run `npm run build:vercel` to rebuild `api/index.mjs`. The build command also runs on Vercel during deployment.
- **routes.ts is 1450 lines**: Do NOT truncate it. This happened once during migration and broke the entire API.

## Features
- UTM link generation with validation and sanitization
- Campaign management with multiple landing pages
- Source/medium templates (base + user-specific)
- Term templates
- Tag management
- Multi-user accounts with RBAC (viewer/editor/admin/super_admin)
- Feature-flag driven pricing tiers (free/starter/professional/enterprise)
- Vendor admin platform at `/vendor-admin-38291` (admin@utmbuilder.vendor / VendorAdmin2025!)
- AI chat wizard for campaign creation (requires starter+ plan)
- Email invitations via Resend
- CSV export of UTM links
- Archive/unarchive campaigns

## Database
- Schema in `shared/schema.ts` (20+ tables)
- On startup, `registerRoutes()` seeds UTM templates and pricing plans, creates default vendor admin
- Push schema: `DATABASE_URL="..." npx drizzle-kit push`

## Pal's Account
- Email: pwaagbo@gmail.com (Google sign-in)
- Role: super_admin
- Plan: Free
- Firebase UID: BcGz6vq4xcTNlqMF9yGjweCErLh1
