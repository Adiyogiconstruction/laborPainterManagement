# Painter Project Handoff Prompt

You are taking over the painter-management product that was separated from a combined Labour and Painter Operations Suite. Build this as an independent, production-ready application. Do not add painter functionality back into the Labour Management project.

## Product scope

Create a secure painter operations workspace for a construction company. The product must cover painter workforce, painter clients/sites, painting work supply, daily site operations, paint inventory, attendance, payments, dashboards, reports, and admin access.

## Features to implement

1. Authentication and access control
   - First-time Owner setup, login, logout, current-user session, JWT protection.
   - Roles: Owner, Admin, Viewer.
   - Owner-only admin access management.
   - Hide mutation controls for Viewer; enforce the same rule in the API.

2. Painter workforce
   - Create, edit, deactivate, search, and list painter profiles.
   - Store name, team, phone, Aadhaar number and front/back documents, address, skill, work zone, PPE issue date, joining date, daily rate, overtime rate, notes, and active state.
   - Worker photo and Aadhaar upload handling with file-size/type validation.
   - Show payable, paid, due, and overpaid totals per painter.

3. Painter clients and sites
   - Client directory with search.
   - Client name, contact details, billing details, notes, and multiple project/site records.
   - Site name, address, contact person, and site notes.
   - Every painting assignment must use a site belonging to the selected client.

4. Painting work supply
   - Create, edit, filter, search, and cancel work-supply assignments.
   - Capture painter/lead painter, optional multiple painters, client, site, description, dates, headcount, work days, unit, client rate, painter rate, billing amount, payout amount, status, and notes.
   - Support daily, square-foot, unit, job, and lump-sum calculations plus explicit overrides.
   - Validate that painter and client/site relationships match.

5. Attendance
   - Daily and monthly painter attendance grids.
   - Statuses: not marked, present, double present, half day, absent, leave.
   - Hours, check-in/out, overtime hours/rate, leave reason, notes, locked date, and copy-yesterday flow.
   - Snapshot daily rate and overtime rate on attendance records.
   - Calculate payable amounts consistently from work units and overtime.

6. Daily DPR / site entries
   - Add, search, list, and delete daily painting site records.
   - Date, site/project, floor, work description, quantity, unit, day status, expense amount, expense category, and notes.
   - Statuses: working, travelling, no work.
   - Summary metrics for working days, quantities, expenses, and completed work.

7. Paint inventory and ledger
   - Dedicated Paint Ledger route and navigation item.
   - Add, filter, search, and delete paint movements.
   - Movement types: purchased, issued to painter, used, returned.
   - Paint name, quantity, unit, date, painter, site/assignment, notes, and optional reference.
   - Calculate purchased, issued, used, returned, and current balance globally and per painter.
   - Prevent invalid negative quantities and clearly show balances.

8. Payments and finance
   - Painter payout ledger with advances, wages, expense payouts, and other outflows.
   - Client receipts/inflows and payment references.
   - Link payments to painter, client, assignment, or site where applicable.
   - Calculate paid, payable, due, advance, expense, and overpaid values without double-counting.
   - Printable/saveable bills and payment records.

9. Dashboard and reports
   - Painter operations dashboard with active painters, active assignments, painter dues, cash paid, paint issued/used/balance, recent transactions, and outstanding work.
   - Reports filterable by date, painter, client, site, assignment status, and payment type.
   - Attendance, operations, payment, payout, expense, and paint movement summaries.
   - Empty, loading, error, and locked states for every screen.

## Technical requirements

- Use the existing project conventions only where useful, but keep this application independent from Labour Management.
- Keep all painter routes, models, API endpoints, and UI labels painter-specific. Do not use a generic LABOUR/PAINTER switch if this is a painter-only app.
- Use structured validation and authenticated API middleware. Never rely only on frontend validation.
- Preserve responsive desktop/mobile navigation and accessible form controls.
- Use consistent date, currency, quantity, and number formatting.
- Add focused automated tests for attendance calculations, assignment calculations, paint balance calculations, authorization, and key API validation.
- Add seed/demo data only behind an explicit development command.
- Document environment variables, MongoDB setup, file uploads, API routes, and local run/build/test commands.

## Acceptance criteria

- A user can set up an Owner, log in, create painters, clients/sites, assignments, attendance, DPR entries, paint movements, and payments end to end.
- All dashboard and report totals reconcile with the underlying records.
- A painter cannot be assigned to a different client site accidentally.
- Paint balance is correct after any sequence of purchase, issue, use, and return transactions.
- Viewer cannot mutate data through either UI or direct API calls.
- Invalid IDs, dates, quantities, rates, missing required fields, unsupported files, and unauthorized requests return useful errors.
- The app has no labour-management navigation, labour records, labour labels, or labour-only routes.
- Build, lint/type checks, and focused tests pass before delivery.
- Test the application at desktop and mobile viewport sizes and verify that navigation, tables, forms, modals, and totals remain usable.

## Delivery workflow

1. Inspect the existing painter-related source and tests before editing.
2. Write a short implementation plan and identify data migrations needed for painter records.
3. Implement backend models, validation, routes, authorization, and tests first.
4. Implement the painter-only frontend routes, navigation, forms, tables, dashboard, reports, responsive states, and print flows.
5. Run focused tests after each feature group, then run the complete build and test suite.
6. Report changed files, migration/data assumptions, commands run, and any remaining risks.
