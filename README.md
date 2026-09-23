# WorkLedger — Labour Operations Suite

A MERN application for a labour-supply business. It keeps labour operations in a single secured system:

- Labour management
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
- **Worker payout**: what is payable to the labour worker/lead for that work.

Billing can start from a blank bill or from an existing work-supply record; the latter pre-fills its client, site, work description and client billing amount. An incoming payment can likewise be linked to a bill, which automatically updates its status to Part paid or Paid.

For per-day work, the system calculates each amount as:

`rate × people supplied × work days`

The amount can also be overridden for job, square-foot or lump-sum work. Payments can be tied to the related work record so dashboard dues remain accurate.

## Run locally

1. Copy `server/.env.example` to the server environment and set `PORT`, `MONGODB_URI`, a long random `JWT_SECRET`, the deployed frontend URL in `CLIENT_ORIGIN`, and all three Cloudinary credentials. Never commit either `.env` file.
2. Copy `client/.env.example` to the frontend build environment and set `VITE_API_URL` to the deployed backend URL ending in `/api`.
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

### Media storage

Worker photos and Aadhaar images are uploaded by the API to Cloudinary. MongoDB stores the secure delivery URL plus the Cloudinary `public_id`, which lets the API remove the previous image when a document is replaced. Existing records with local `/uploads/...` paths remain readable until they are replaced.

## Frontend structure

The client is organized by responsibility so feature work stays local:

- `client/src/pages/` contains one file per route, plus the authentication page and a small route barrel.
- `client/src/layout/AppShell.jsx` owns navigation, responsive shell behavior, and route protection.
- `client/src/components/ui/` contains shared presentational controls.
- `client/src/services/apiClient.js` centralizes API configuration and response errors.
- `client/src/utils/formatters.js` contains display-only date, currency, and number helpers.
- `client/src/styles/` separates global browser defaults from the scoped design-system CSS module. The design module is split into focused partials for shell, UI, metrics, forms, authentication, and responsive rules.

## Key API areas

| Area                  | Endpoint prefix    |
| --------------------- | ------------------ |
| Login and admins      | `/api/auth`        |
| Dashboard totals      | `/api/dashboard`   |
| Clients and sites     | `/api/clients`     |
| Labour workers        | `/api/workers`     |
| Work supply           | `/api/assignments` |
| Payments and advances | `/api/payments`    |
| Bills / invoices      | `/api/invoices`    |
| Reports               | `/api/reports`     |

## Next production decisions

Before go-live, confirm the actual bill template, GST/HSN requirements, payment approval rules, and whether individual labour attendance must be recorded separately from a lead-worker supply entry. The current model is intentionally ready for those additions without changing the main financial flow.

Painter requirements belong to the separate project and are documented in [PAINTER_PROJECT_HANDOFF_PROMPT.md](PAINTER_PROJECT_HANDOFF_PROMPT.md).

## Hostinger production layout

Deploy the `client` as a static Vite site and publish its `client/dist` directory as the document root. Deploy the `server` as a Hostinger Node.js application with the start command `npm start`, application root `server`, and the port supplied by Hostinger through `PORT`. Configure all server environment variables in Hostinger; do not upload `.env` files containing credentials.

Use separate HTTPS hostnames, for example `app.example.com` for the frontend and `api.example.com` for the Node API. Set `client/.env` before `npm run build`, with `VITE_API_URL=https://api.example.com/api`, and set the same frontend URL in the server's `CLIENT_ORIGIN`. In MongoDB Atlas, add the Hostinger outbound IP addresses to the Network Access allowlist; avoid `0.0.0.0/0` for production unless Hostinger's outbound IP is not fixed.
