# Vana Power Mart — go-live checklist

## 1. Update your computer (once)

```bash
cd server
npm install                 # adds helmet and express-rate-limit
npx prisma migrate deploy   # adds the new tables (2 migrations); existing data is untouched
npx prisma generate
```

Back up first if you like: Prisma Console → your database → Backups, or `pg_dump`.
The migration `20261108120000_operations_payments_customers` only **adds** tables and
columns, records today's stock as the opening stock history, and copies customer
contact details onto existing orders.

## 2. server/.env

Compare with `server/.env.example`. Required changes:

- `JWT_SECRET` — replace with a long random value (the current one is 11 characters):
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
  Everyone logs in again afterwards.
- `PAYMENT_PROVIDER=simulator` to test now; `gateway` once the gateway keys arrive.
- `PUBLIC_SITE_URL`, `PUBLIC_API_URL`, `CORS_ORIGINS` — your real domains in production.
- `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID` — Africa's Talking, for SMS.

Frontend: copy `.env.example` (project root) to `.env` and set `VITE_API_URL`,
`VITE_SITE_URL` and, once you have it, `VITE_GA_MEASUREMENT_ID`.

## 3. Run it

```bash
cd server && npm run dev        # API on http://localhost:4000
npm run dev                     # (project root) store on http://localhost:5173, admin at /admin
```

## 4. Set up the shop (Admin)

1. **Settings** — store phone, staff phones for new-order SMS, free-delivery threshold,
   collection address. The Connections box shows whether payments and SMS are live.
2. **Delivery** — add your zones and fees (e.g. Kampala Central, Wakiso, Entebbe, Upcountry).
3. **Categories** — create the categories; subcategories are optional (one level).
4. **Suppliers** — add each supplier.
5. **Products** — add products; stock, flash-sale price and dates are on the product form.
6. **Inventory** — for each product, add the supplier's wholesale price and how many they
   have ("Supplier price"). Then set sellable stock ("Adjust", or "Use N" to copy the
   supplier's confirmed quantity). Margins show per product.
7. **Promotions** — optional voucher codes (e.g. WELCOME10).

## 5. Daily order flow

1. New order → SMS to staff phones; it appears in **Orders** and on the dashboard.
2. Open the order → for each item choose the supplier (cost fills in), call them, set
   **Sourcing status** (Requested → Confirmed / Unavailable → Collected or Supplier dispatched).
3. Set the order to **Confirmed** (customer gets an SMS).
4. **Delivery**: choose our rider, a courier or supplier-direct; enter the rider's name and
   phone and what delivery cost us. Set **Out for delivery** — the customer gets the
   rider's number by SMS and on the tracking page.
5. **Delivered** with proof (who received it). Cash orders: set Payment to **Paid**.
6. Gross profit shows on the order once every item has a cost.

Stock rule: orders take stock when placed; out-of-stock orders become **Awaiting Stock**
and take it when you move them on; cancelling (reason required) returns it.

## 6. Connecting the payment gateway

Everything gateway-specific is in `server/src/lib/payments.ts`, in the `gateway` object.
It currently assumes:

- `POST {BASE_URL}/collections` with `reference, amount, currency, phone, network, description, callback_url`
- `GET {BASE_URL}/collections/{reference}` for status
- Webhook to `{PUBLIC_API_URL}/api/payments/webhook`, signed with HMAC-SHA256 of the raw
  body in the `x-signature` header, with `reference, status, amount, transaction_id`

When the documentation arrives, adjust those field names, set `PAYMENT_PROVIDER=gateway`,
and test with a small real payment. Orders are marked Paid only after the gateway
confirms, never by the browser, and a payment for less than the order total is refused.

## 7. Hosting and domain

- Set `NODE_ENV=production` on the API server. It then **refuses to start** if the JWT secret
  is short, if the payment simulator is on, if the gateway has no webhook secret, or if
  `CORS_ORIGINS` is missing.
- Sitemap: the API serves it at `/api/store/sitemap.xml`. Point `https://your-domain/sitemap.xml`
  there (on Vercel, add a rewrite above the existing one in `vercel.json`:
  `{ "source": "/sitemap.xml", "destination": "https://YOUR-API/api/store/sitemap.xml" }`),
  then add the `Sitemap:` line in `public/robots.txt` and submit it in Google Search Console.
- Analytics: create a Google Analytics 4 property, put its ID in `VITE_GA_MEASUREMENT_ID`, rebuild.
  It records page views, add to cart, checkout started and purchases.
- Sign-up codes: until SMS is connected, the code shows on screen in development only. In
  production, sign-up is paused (guest checkout still works) until SMS is connected.

## 8. Before going public

- [ ] Migration applied; one test order end to end on the live database
- [ ] New JWT secret and strong admin password
- [ ] SMS provider connected and a test SMS received
- [ ] Gateway tested with a small real payment, then a refund
- [ ] `git rm -r --cached database-backups` if the folder was ever committed
- [ ] Provider backups confirmed and one restore tested
- [ ] Frontend built with `VITE_API_URL` and `VITE_SITE_URL` set to the live addresses
- [ ] Store phone, collection address and staff phones set in Admin → Settings
  (they appear on the Contact, Privacy and Terms pages)
- [ ] Privacy policy and terms read by you (ideally a lawyer); registered with Uganda's
  Personal Data Protection Office
- [ ] A shared link previewed on WhatsApp shows the Vana image

## Known limits

- One stock count per product (no separate stock per size/colour version yet).
- Refunds are sent by you, then recorded on the return; the system doesn't push money back.
- Reports section is still a placeholder.
