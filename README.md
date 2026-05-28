# Compliance Agent V2 — Frontend UI

Production-oriented **frontend-only** shell for the Relnto Micro-LMS. Teammates can extend individual feature areas without blocking on backend work.

## Stack

- **Next.js 15** (App Router) + **React 19**
- **Tailwind CSS v4** — zinc palette, tight typography, crisp shadows
- **Framer Motion** — MCQ modal & micro-interactions
- **Lucide React** — icons
- **Zustand** + **PapaParse** — CSV-backed mock auth

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo logins

| Email | Password | Role |
|-------|----------|------|
| admin@relnto.com | admin123 | Admin → `/admin` |
| user1@relnto.com | user123 | User (batch_a) |
| user2@relnto.com | user123 | User (batch_a) |
| user3@relnto.com | user123 | User (batch_b) |

## Project structure (for team ownership)

```
src/
├── app/                    # Routes only — thin pages
│   ├── login/
│   ├── dashboard/          # Employee home
│   ├── training/[id]/      # Fullscreen slide viewer
│   └── admin/              # Admin command center
├── components/
│   ├── auth/               # Login, route guard
│   ├── brand/              # Relnto logo
│   ├── employee/           # Module cards, slide viewer, MCQ, Q&A
│   ├── admin/              # Metrics, batch table, live panel, AI report
│   ├── layout/             # App shell / nav
│   └── ui/                 # Primitives (Button, Card, Input)
└── lib/
    ├── auth-store.ts       # CSV login (replace with API)
    ├── mock-data.ts        # Modules, MCQs, analytics, AI report
    └── types.ts
```

## Feature map → ownership suggestions

| Area | Path | Notes |
|------|------|--------|
| Auth / API swap | `lib/auth-store.ts`, `lib/mock-data.ts` | Replace PapaParse CSV with FastAPI JWT |
| Employee dashboard | `components/employee/module-card.tsx` | Wire real assignment API |
| Slide viewer | `components/employee/slide-viewer.tsx` | PPT/PDF renderer, WebSocket sync |
| MCQ gates | `components/employee/mcq-modal.tsx` | Server validation endpoint |
| Final Q&A | `components/employee/final-qa-form.tsx` | POST feedback to admin |
| Admin metrics | `components/admin/*` | Real-time dashboard data |
| Live push | `components/admin/live-control-panel.tsx` | Redis + WebSocket |
| AI reports | `components/admin/ai-report-panel.tsx` | Gemini streaming |

## Mock behaviors (intentional)

- Login validates against embedded CSV in `AUTH_CSV`
- MCQ appears every **3** “Next slide” clicks; correct answer required to proceed
- Fullscreen requested on training launch (browser Fullscreen API)
- Admin “Execute” buttons log simulated broadcast messages only

## Environment

Copy `.env.example` when backend keys are added (e.g. `NEXT_PUBLIC_API_URL`). Frontend runs without env for now.
