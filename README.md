# DipperAI

AI Agent Builder SaaS — build, deploy, and manage AI agents for SMS, Telegram, Discord, and more.

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4
- **Backend:** Express.js + TypeScript
- **Database:** SQLite (better-sqlite3)
- **AI:** Anthropic Claude, Google Gemini, OpenAI
- **Auth:** JWT

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in at minimum:
- `ANTHROPIC_API_KEY` — required for Claude-powered agents
- `JWT_SECRET` — any random string (e.g. `openssl rand -hex 32`)

### 3. Run dev server

```bash
npm run dev
```

This starts the Express server (with Vite middleware) on `http://localhost:3001`.

---

## Production Build

```bash
npm run build
```

Then start the production server:

```bash
node --loader tsx server.ts
```

Or with `tsx` installed globally:

```bash
tsx server.ts
```

The server serves the built frontend from `dist/` automatically in production mode.

---

## Deploy to Railway

1. Push this repo to GitHub
2. Connect the repo to [Railway](https://railway.app)
3. Set environment variables in Railway dashboard (see `.env.example`)
4. Railway will auto-detect `railway.json` and run the build + start command

### Required Railway env vars:
- `ANTHROPIC_API_KEY`
- `JWT_SECRET`
- `PORT` (Railway sets this automatically)

---

## Admin Access

Use this credential for admin login (full access):
- Email: `admin@dipperai.com`
- Password: `DipperAdmin2026!`

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/agents` | List agents |
| POST | `/api/agents` | Create agent |
| GET | `/api/agents/:id` | Get agent |
| PUT | `/api/agents/:id` | Update agent |
| DELETE | `/api/agents/:id` | Delete agent |
| POST | `/api/agents/:id/chat` | Chat with agent |
| GET | `/api/templates` | List templates |
| GET | `/api/analytics` | Get analytics |
