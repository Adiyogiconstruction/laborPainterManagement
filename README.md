# WorkLedger — Labour & Painter Operations Suite

A MERN application for a labour-supply and painter-supply business. It keeps the three requested areas in a single secured system:

- Labour management
- Painter management
- Client billing

It also includes clients/sites, work-supply records, worker advances, wages, client receipts, due calculations, reporting and multiple admin accounts.

## Stack

- React + Vite frontend
- Node.js + Express REST API
- MongoDB + Mongoose
- JWT-based authentication with Owner, Admin and Viewer roles

## Business logic

Each work-supply record holds both sides of the transaction:

- **Client billing**: what the client owes for the supplied labour/painter workforce.
- **Worker payout**: what is payable to the worker/lead for that work.

Billing can start from a blank bill or from an existing work-supply record; the latter pre-fills its client, site, work description and client billing amount. An incoming payment can likewise be linked to a bill, which automatically updates its status to Part paid or Paid.

For per-day work, the system calculates each amount as:

`rate × people supplied × work days`

The amount can also be overridden for job, square-foot or lump-sum work. Payments can be tied to the related work record so dashboard dues remain accurate.

## Run locally

1. Start MongoDB locally, or run the included `docker-compose.yml` on a machine with Docker installed.
2. Copy `server/.env.example` to `server/.env` and set a production-quality `JWT_SECRET`.
3. Install packages:

   ```powershell
   npm run install:all
   ```

4. Start the API and frontend together:

   ```powershell
   npm run dev
   ```

5. Open `http://localhost:5173`. The first screen creates the initial Owner account; subsequent users sign in normally.

The production frontend check is available with:

```powershell
npm run build
```

## Frontend structure

The client is organized by responsibility so feature work stays local:

- `client/src/pages/` contains one file per route, plus the authentication page and a small route barrel.
- `client/src/layout/AppShell.jsx` owns navigation, responsive shell behavior, and route protection.
- `client/src/components/ui/` contains shared presentational controls.
- `client/src/services/apiClient.js` centralizes API configuration and response errors.
- `client/src/utils/formatters.js` contains display-only date, currency, and number helpers.
- `client/src/styles/` separates global browser defaults from the scoped design-system CSS module. The design module is split into focused partials for shell, UI, metrics, forms, authentication, and responsive rules.

## Key API areas

| Area | Endpoint prefix |
| --- | --- |
| Login and admins | `/api/auth` |
| Dashboard totals | `/api/dashboard` |
| Clients and sites | `/api/clients` |
| Labour and painters | `/api/workers` |
| Work supply | `/api/assignments` |
| Payments and advances | `/api/payments` |
| Bills / invoices | `/api/invoices` |
| Reports | `/api/reports` |

## Next production decisions

Before go-live, confirm the actual bill template, GST/HSN requirements, payment approval rules, and whether individual labour attendance must be recorded separately from a lead-worker supply entry. The current model is intentionally ready for those additions without changing the main financial flow.
