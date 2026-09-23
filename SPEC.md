### 1.1 Product Summary

**MindFlow** is a personal task and thought management system. It solves three problems:
- **Capture friction** — people don't log fleeting thoughts because apps demand upfront categorization
- **Organization overhead** — captured items rot in a list because nobody manually schedules them
- **Static planning** — calendars don't adapt to real behavior, durations, or energy patterns

**Loop:** Zero-friction capture → Auto-classification → Constraint-based auto-scheduling → Feedback-driven personalization.

### 1.2 v1 Feature Scope (build only this — no scope creep)

| # | Feature | Must include |
|---|---|---|
| 1 | Quick Capture | Single text input, no required fields, submits instantly |
| 2 | Auto-Classification | category (task/idea/reminder/deadline), priority (1–5), est. duration (min), deadline (if parseable), topic tag |
| 3 | Smart Inbox | List of unscheduled items, sortable/filterable |
| 4 | Routine Profile | CRUD for fixed commitments + preferred work/break hours |
| 5 | Auto-Scheduler | Places inbox items into free slots, respects buffers |
| 6 | Reschedule Engine | Daily job: pushes unfinished items forward intelligently |
| 7 | "What should I do now?" | Given current time, suggest best-fit item |
| 8 | Feedback Loop | Logs estimate vs actual, adjusts per-category duration multiplier |

**Explicitly out of scope for v1:** multi-user auth beyond a single local user, push notifications, native mobile app, third-party calendar sync (Google Calendar etc.), team/collab features. Do not build these unless asked.

### 1.3 Tech Stack (100% free-tier)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + Vite + TailwindCSS | SPA, no SSR needed |
| Backend | FastAPI (Python 3.11+) | REST/JSON API |
| DB (dev) | SQLite | File-based, zero setup |
| DB (prod, optional) | Supabase free tier (Postgres) | Only if deploying beyond local |
| NLP — rules | `dateparser`, `spaCy` (small model) | Free, offline |
| NLP — embeddings | `sentence-transformers` (`all-MiniLM-L6-v2`) | Free, CPU-only |
| NLP — LLM fallback | Gemini API free tier | Used only for ambiguous captures |
| Scheduler | Custom heuristic; optional `OR-Tools` later | Free, open-source |
| Hosting (backend) | Render or Railway free tier | Optional — local-first is fine |
| Hosting (frontend) | Vercel/Netlify free tier | Optional |

**Hard constraint:** every dependency must have a free tier or be fully open-source/offline. Flag anything that requires a paid key before adding it.

### 1.4 Data Model

```sql
items(
  id INTEGER PRIMARY KEY,
  raw_text TEXT NOT NULL,
  category TEXT CHECK(category IN ('task','idea','reminder','deadline')),
  priority INTEGER CHECK(priority BETWEEN 1 AND 5),
  est_duration_min INTEGER,
  deadline DATETIME NULL,
  status TEXT CHECK(status IN ('inbox','scheduled','done','skipped')) DEFAULT 'inbox',
  topic_tag TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)

routine_blocks(
  id INTEGER PRIMARY KEY,
  day_of_week INTEGER CHECK(day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  label TEXT,
  fixed BOOLEAN DEFAULT 1
)

schedule_slots(
  id INTEGER PRIMARY KEY,
  item_id INTEGER REFERENCES items(id),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  auto_generated BOOLEAN DEFAULT 1
)

feedback_log(
  id INTEGER PRIMARY KEY,
  item_id INTEGER REFERENCES items(id),
  estimated_duration INTEGER,
  actual_duration INTEGER,
  suggestion_accepted BOOLEAN,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)

user_prefs(
  user_id INTEGER PRIMARY KEY DEFAULT 1,
  preferred_deep_hours TEXT,       -- JSON e.g. ["09:00-11:00"]
  break_duration_pref INTEGER DEFAULT 10,
  category_duration_multiplier TEXT -- JSON e.g. {"study": 1.4}
)
```

### 1.5 Classification Pipeline (cost-control is critical)

Run in this order, stop as soon as confident:

1. **Rule pass** (instant, free): regex + `dateparser` for explicit dates/times ("by Friday 5pm", "tomorrow"); keyword heuristics for category (verbs like "buy/submit/finish" → task; "explore/learn/read about" → idea; "remind me" → reminder).
2. **Local embedding pass** (free, offline): embed input with `all-MiniLM-L6-v2`, compare via cosine similarity to a small labeled example set (~20–30 examples per category) stored in the repo. Use this to fill in category/priority when the rule pass is unsure.
3. **LLM fallback** (only if steps 1–2 leave category or duration undetermined, target <20% of inputs): call Gemini free tier with a strict JSON-only response schema:
```json
{"category": "task|idea|reminder|deadline", "priority": 1, "est_duration_min": 30, "deadline": "ISO-8601 or null", "topic_tag": "string"}
```
Never let the LLM call block the UI — classify async, show item in inbox immediately with a "classifying…" state, update in place when done.

### 1.6 Scheduler Algorithm

Greedy bin-packing (v1) — do NOT reach for OR-Tools until greedy is proven insufficient:

1. Compute today's free time blocks = full day minus `routine_blocks` (fixed=1).
2. Compute `urgency_score = w1*deadline_proximity + w2*priority + w3*days_in_inbox` (weights configurable, sane defaults: 0.5/0.3/0.2).
3. Sort inbox items by `urgency_score` descending.
4. For each item, find the best-fit free slot:
   - Slot duration ≥ item's `est_duration_min` (adjusted by that category's `category_duration_multiplier`)
   - Prefer slots inside `preferred_deep_hours` for high-priority/focus items
   - Never schedule two duration >45min deep-work items back-to-back without inserting `break_duration_pref` minutes
5. Write chosen slot to `schedule_slots`, mark item `status='scheduled'`.
6. Unplaceable items stay in inbox (don't force-fit) and are flagged "couldn't fit today."

**Reschedule job** (run once daily, e.g. on first app load of a new day): any `schedule_slots` row from a past date whose item is not `done` → delete slot, item reverts to `inbox` with `days_in_inbox` incremented, re-run scheduler.

### 1.7 Feedback / Learning Loop (v1 — keep simple)

- When user marks an item done, prompt (optional, skippable) for actual time taken.
- Store in `feedback_log`.
- Nightly (or on-demand) job: for each `topic_tag`/category with ≥5 feedback entries, compute `avg(actual/estimated)` and update `category_duration_multiplier` in `user_prefs`.
- Apply multiplier when estimating duration for future items of that category.
- Do not build a general ML model in v1 — this heuristic is intentional and sufficient.

### 1.8 API Contract (minimum viable endpoints)

```
POST   /items                 → create item (raw_text only required), returns item with classification (may be async)
GET    /items?status=inbox    → list items
PATCH  /items/{id}            → update item (manual override of category/priority/duration/deadline)
DELETE /items/{id}
POST   /items/{id}/complete   → mark done, optional {actual_duration}

GET    /routine
POST   /routine               → add routine_block
DELETE /routine/{id}

POST   /schedule/run          → trigger scheduler for a given date
GET    /schedule?date=YYYY-MM-DD

GET    /suggest/now           → best-fit item for current time
```

### 1.9 Build Order (do not reorder or skip ahead)

1. Backend skeleton: FastAPI + SQLite + all tables via migrations, full CRUD on `items` (no intelligence yet)
2. Frontend skeleton: Capture bar + Smart Inbox list wired to CRUD — validate the core UX loop end-to-end
3. Rule-based classification only (dates, keyword priority) — no ML/LLM yet
4. Routine profile screen + `routine_blocks` CRUD
5. Greedy scheduler v1 (heuristic, no ML) + Day/Timeline view in frontend
6. Embedding-based classification upgrade (layer 2)
7. Feedback logging + duration-multiplier learning job
8. "What should I do now?" endpoint + widget
9. LLM fallback for ambiguous captures (layer 3) — added last, since it's the only paid-quota dependency

**Stop and check in with the user after each numbered step.** Do not silently jump ahead to step 5 while "also" doing step 7.

### 1.10 Non-Negotiable Engineering Rules

- Every free-tier/API dependency must be confirmed free before use; flag anything ambiguous instead of assuming.
- No hardcoded secrets — use `.env` + `.env.example`, and `.env` must be in `.gitignore`.
- Every endpoint needs basic input validation (Pydantic models) and error responses, not bare 500s.
- Write at minimum: unit tests for the scheduler algorithm (pure function, easy to test) and the rule-based classifier. Don't skip tests to move faster.
- Keep the classification pipeline modular — rule/embedding/LLM layers must be swappable functions behind one interface, not tangled together.
- No feature from later build-order steps leaks into earlier ones "for convenience."

---