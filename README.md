# Ledger frontend

React + Vite frontend for the Ledger trading journal. Talks to the
`journal-backend` API for all data — nothing is stored in the browser.

## 1. Install dependencies

```
npm install
```

## 2. Configure the API URL

Copy `.env.example` to `.env`:

```
cp .env.example .env
```

By default it points at `http://localhost:4000`, which matches the
backend's default port. Only change this if your backend runs somewhere
else (e.g. once it's deployed online).

## 3. Make sure the backend is running

This frontend has nothing to show without the backend (`journal-backend`)
running and connected to Postgres. Start that first — see its own README.

## 4. Start the frontend

```
npm run dev
```

Open the URL it prints (usually **http://localhost:5173**).

## What's running

- `src/api.js` — all calls to the backend (`getTrades`, `createTrade`,
  `importTrades`, `updateTrade`, `deleteTrade`)
- `src/App.jsx` — the full journal UI: dashboard, trade log, strategy tag
  breakdown, the "Log trade" form, and the import flow for
  `journal_trades.json`

## Troubleshooting

**"Couldn't reach the journal API" screen on load**
The backend isn't running, isn't reachable at the URL in `.env`, or
Postgres isn't connected on the backend side. Check the backend terminal
for errors, and confirm `http://localhost:4000/health` (or whatever URL
is in your `.env`) returns `{"status":"ok"}` in a browser.

**CORS errors in the browser console**
Make sure `ALLOWED_ORIGINS` in the backend's `.env` includes
`http://localhost:5173` (the default Vite dev server URL).
