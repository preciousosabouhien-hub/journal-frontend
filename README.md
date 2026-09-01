# Ledger — Frontend

The client-side of Ledger, a personal trading journal for MetaTrader 5 traders. Built with React and Tailwind CSS.

## What it does

- Displays an equity curve, win rate, profit factor, average win/loss, and average R:R ratio on a live dashboard
- Shows a trade log with visual risk-reward bars and inline strategy tagging
- Breaks down performance by strategy tag so you can see which setups are actually working
- Lets you log trades manually, edit existing ones, delete them, and bulk-import from the MT5 sync pipeline
- Authenticates against the backend API — viewing is public, editing requires your password

## Tech stack

- **Framework:** React 18
- **Build tool:** Vite
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Icons:** Lucide React
- **Auth:** JWT stored in localStorage, attached to mutating API requests
- **Hosting:** Render (static site, free tier)

## Project structure

```
journal-frontend/
├── src/
│   ├── main.jsx      # React entry point
│   ├── App.jsx       # Full application — all components and pages
│   ├── api.js        # API client (fetch wrapper, token handling, AuthError)
│   └── index.css     # Tailwind base styles + font imports
├── index.html        # HTML entry point
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env.example      # Environment variable template
└── README.md
```

## Local setup

### Prerequisites

- Node.js 18+
- The `journal-backend` running locally (see its README)

### Steps

**1. Clone the repo and install dependencies**
```bash
git clone https://github.com/preciousosabouhien-hub/journal-frontend.git
cd journal-frontend
npm install
```

**2. Configure environment variables**
```bash
cp .env.example .env
```

The default points at `http://localhost:4000` which matches the backend's default port. Only change this if your backend runs on a different port or you're pointing at the deployed backend.

**3. Start the dev server**
```bash
npm run dev
```

Open `http://localhost:5173`. The dashboard loads your trades from the backend automatically.

**Troubleshooting:** If you see "Couldn't reach the journal API", make sure the backend is running (`npm start` in the `journal-backend` folder) and that `http://localhost:4000/health` returns `{"status":"ok"}` in your browser.

## Building for production

```bash
npm run build
```

Output goes to the `dist/` folder — these are the static files Render serves.

## Deploying to Render

1. Push this repo to GitHub
2. Create a new **Static Site** on [render.com](https://render.com), connected to this repo
3. Set build command: `npm install && npm run build`
4. Set publish directory: `dist`
5. Add environment variable: `VITE_API_URL` → your deployed backend URL (e.g. `https://your-backend.onrender.com`)
6. Deploy — Render builds and serves the static files automatically

Auto-deploy is enabled by default, so every push to `main` triggers a new deploy. If a deploy doesn't pick up after a push, trigger it manually from the Render dashboard.

## Authentication

- Viewing the dashboard, trade log, and strategy tags is open to anyone with the link
- Adding, editing, deleting, and importing trades requires logging in with your password
- The lock icon in the top-right header opens the login modal
- Sessions last 7 days — after that, logging in again is required
- The token is stored in `localStorage` under the key `ledger_token`

## MT5 import flow

After running the MT5 sync scripts (`mt5_pull.py` → `convert_to_journal.py`), you get a `journal_trades.json` file. To load it into the journal:

1. Log in using the lock icon in the header
2. Click **Import** in the header
3. Upload `journal_trades.json` or paste its contents
4. Imported trades are added to your existing ones — re-importing won't create duplicates (the backend deduplicates by MT5 ticket number)
5. Tag any untagged trades in the Trade log using the inline tag editor

## Strategy tags

The six built-in strategy tags are: `Breakout`, `Pullback`, `Reversal`, `News`, `Range`, `Trend Follow`. These can be edited directly in `src/App.jsx` in the `STRATEGY_TAGS` constant at the top of the file if you want to use your own labels.
