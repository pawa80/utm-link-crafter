# UTM Link Crafter

## What This Is
Full SaaS app for digital marketers to create, manage, and organise UTM tracking links for campaigns. Built on Replit ~mid 2025, migrated to GitHub/Vercel Feb 2026. See `PRODUCT_SPEC.md` for full product documentation.

## Live URL
https://utm-link-crafter-jg3g.vercel.app

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind + shadcn/ui (Radix)
- **Backend**: Express.js + TypeScript (serverless on Vercel)
- **Database**: PostgreSQL via Neon serverless, Drizzle ORM
- **Auth**: Firebase (`utmlinkcrafter-replitnew`), Google sign-in + email/password
- **Email**: Resend (optional, for invitations)
- **Routing**: Wouter (lightweight)
- **State**: React Query (@tanstack/react-query)
- **Hosting**: Vercel

## Architecture
- `npm run build:vercel` → Vite builds frontend to `dist/public/`, esbuild bundles server to `api/index.mjs`
- Vercel serves `dist/public/` as static, `api/index.mjs` as serverless function
- Rewrites: `/api/*` → function, everything else → `index.html` (SPA)
- Database schema managed by Drizzle, pushed via `drizzle-kit push`

## Key Directories
- `client/src/pages/` — React pages (HomePage, NewCampaign, CampaignManagement, Settings, TemplateManagement, TagManagement, AccountManagement, ChatWizardPage, AcceptInvitation)
- `client/src/components/` — Reusable components (CampaignWizard.tsx is 1930 lines — the main campaign creation form)
- `client/src/hooks/` — useFeatures.ts (feature gating), use-toast.ts
- `client/src/lib/` — firebase.ts, auth.ts, utm.ts, queryClient.ts
- `server/routes.ts` — Main API (~1500 lines, ALL routes)
- `server/storage.ts` — DB abstraction layer
- `server/vendorRoutes.ts` — Vendor admin API
- `shared/schema.ts` — Drizzle schema (20+ tables) + Zod types
- `shared/validation.ts` — UTM parameter validation and sanitisation

## Environment Variables (Vercel)
- `DATABASE_URL` — Neon PostgreSQL connection string
- `VITE_FIREBASE_API_KEY` — set in Vercel env vars (do not commit)
- `VITE_FIREBASE_PROJECT_ID` — `utmlinkcrafter-replitnew`
- `VITE_FIREBASE_APP_ID` — set in Vercel env vars (do not commit)
- `RESEND_API_KEY` — optional, for email invitations

## Important Conventions
- **Imports**: All server-side imports MUST use relative paths with `.js` extensions (e.g., `from "../shared/schema.js"`). Do NOT use `@shared/*` path aliases — Vercel cannot resolve them.
- **Native modules**: Do NOT use native Node.js modules (like `bcrypt`). Use pure JS alternatives (like `bcryptjs`). Vercel serverless doesn't support native compilation.
- **After changing server code**: Run `npm run build:vercel` to rebuild `api/index.mjs`. The build command also runs on Vercel during deployment.
- **routes.ts is ~1500 lines**: Do NOT truncate it. This happened once during migration and broke the entire API.
- **CampaignWizard.tsx is ~1930 lines**: The main campaign form. Complex state management — read before editing.

## Vendor Admin
- URL: `/vendor-admin-38291`
- Credentials: admin@utmbuilder.vendor / [set via `VENDOR_ADMIN_PASSWORD` env var in Vercel, fallback `CHANGE_ME_ON_FIRST_LOGIN`]
- Manages: accounts, pricing plans, base templates, analytics

## Feature Gating
- Plans stored in `pricingPlans` table with `features` JSON column
- Server: `requireFeature(key)` middleware
- Client: `useHasFeature(key)` hook + `FeatureGate` component
- Settings page gates: `customTemplates`, `tagManagement`, `multiUser`
- HomePage gates: `chatWizard`

## Database
- Schema in `shared/schema.ts` (20+ tables)
- On startup, `registerRoutes()` seeds UTM templates and pricing plans, creates default vendor admin
- Push schema: `DATABASE_URL="..." npx drizzle-kit push`

## Pal's Account
- Email: pwaagbo@gmail.com (Google sign-in)
- Role: super_admin
- Plan: Enterprise (upgraded Feb 2026)
- Firebase UID: BcGz6vq4xcTNlqMF9yGjweCErLh1

## Rolling Handover
Last session: Feb 12 2026

### What was done (session 2 — Feb 12 2026)
- Fixed missing save button on new campaign form (autoPopulateUtmLinks didn't fall back to targetUrl when no landing pages existed)
- Fixed tagManagement feature missing from all pricing plans (Morten never added it to plan features JSON)
- Upgraded Pal's account from free to enterprise via admin endpoint
- Created PRODUCT_SPEC.md with full reverse-engineered product specification

### What was done (session 1 — Feb 12 2026)
- Migrated Replit project to Vercel: fixed imports, bcryptjs swap, pre-bundled serverless function
- Restored routes.ts from 360→1450 lines (migration commit had truncated all API routes)
- Simplified signup flow: auto-selects free plan, handles existing Firebase users
- Firebase auth: enabled Google sign-in, added Vercel domain to authorized domains
- All core features verified working via manual + Chrome extension QA

### Known issues
- Usage limits (maxCampaigns, maxUsers, maxUtmLinks) stored in plans but not enforced at API level
- VendorFeatureManagement page exists but has no UI implementation
- Profile Settings and Notifications cards are "Coming Soon" placeholders
- No payment/billing integration yet
- ~~Admin upgrade endpoint still active (remove when no longer needed for UAT)~~ **REMOVED 25/02/2026** (security review)
- Replit plugin remnants still in vite.config.ts, emailService.ts, routes.ts (dead code from migration — clean up when next touching this project)
- **`api/index.mjs` needs rebuild**: CORS fix and admin endpoint removal are in source files but the bundled `api/index.mjs` still has the old code. Run `npm run build:vercel` before next deploy.

### Security fixes applied (25/02/2026 — COO security review)
1. **CORS restricted**: `server/index.ts` and `server/vercel-app.ts` — wildcard `*` replaced with allowlist (Vercel domain + localhost)
2. **Admin endpoint removed**: `server/routes.ts` — `/api/admin/upgrade-enterprise` deleted (was privilege escalation vector with hardcoded key)
3. **Vendor password externalised**: `server/setupVendorSystem.ts` — hardcoded `VendorAdmin2025!` replaced with `process.env.VENDOR_ADMIN_PASSWORD`. Set this env var in Vercel before next deploy.
4. **ACTION NEEDED**: Run `npm run build:vercel` to regenerate `api/index.mjs` with these fixes, then deploy.
