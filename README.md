# MindFlow

> Capture a thought. Let your plan catch up.

MindFlow is a local-first personal task and thought manager that turns quick, unstructured notes into an adaptive daily plan. Capture something in one line, let the app classify and schedule it around your routine, then use completion feedback to make future estimates more accurate.

Built with React, FastAPI, and PostgreSQL—no account or hosted service is required for the core experience.

## What it does

- **Quick capture** — add a task, reminder, deadline, or idea without filling out a form.
- **Smart classification** — extracts category, priority, duration, deadline, and topic with a layered rules → local embeddings → optional Gemini fallback pipeline.
- **Smart inbox** — review, filter, edit, complete, or delete captured items.
- **Routine-aware planning** — add fixed weekly commitments, preferred focus windows, and a break preference.
- **Automatic scheduling** — ranks inbox items by urgency and places them in available time without forcing items that do not fit.
- **Daily timeline** — see generated schedule slots for the day and trigger a fresh scheduling run.
- **Now suggestion** — get a context-aware recommendation for what to do next.
- **Learning loop** — log actual completion time and recalibrate per-category duration estimates from your feedback.

## How it works

```text
Quick capture
     ↓
Rules → local embeddings → optional Gemini fallback
     ↓
Smart inbox
     ↓
Routine-aware greedy scheduler
     ↓
Today's timeline + "What should I do now?"
     ↓
Completion feedback improves future estimates
```

The scheduler prioritizes deadline proximity, item priority, and time waiting in the inbox. It reserves fixed routine blocks, favors preferred deep-work hours for demanding work, and avoids consecutive long focus sessions without a break.

## Tech stack

| Layer | Technology |
| --- | --- |
| Client | React 19, Vite, Tailwind CSS, Lucide |
| API | FastAPI, Pydantic, Uvicorn |
| Persistence | PostgreSQL, SQLAlchemy, Alembic, Psycopg 3 |
| Local NLP | dateparser, sentence-transformers |
| Optional AI fallback | Google Gemini |
| Tests | pytest, HTTPX |

## Run locally

### Prerequisites

- Python 3.11+
- Node.js 20+
- npm
- PostgreSQL 14+

### 1. Set up PostgreSQL

Create a PostgreSQL database and user for MindFlow:

```bash
# Connect to PostgreSQL (adjust for your setup)
psql -U postgres

# Inside psql:
CREATE USER mindflow WITH PASSWORD 'mindflow';
CREATE DATABASE mindflow OWNER mindflow;
\q
```

### 2. Configure environment

Copy the example environment file and adjust if needed:

```bash
cp .env.example .env
```

The default `DATABASE_URL` connects to a local PostgreSQL instance:

```env
DATABASE_URL=postgresql+psycopg://mindflow:mindflow@localhost:5432/mindflow
```

Adjust the connection string if your PostgreSQL server uses different credentials, host, or port:

```
DATABASE_URL=postgresql+psycopg://username:password@host:port/database_name
```

### 3. Start the API

From the repository root:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

```bash
# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate
```

Install dependencies, run database migrations, and start the server:

```bash
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

The API is available at <http://127.0.0.1:8000>; interactive API documentation is at <http://127.0.0.1:8000/docs>.

### 4. Start the web app

Open a second terminal from the repository root:

```bash
cd frontend
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. In development, Vite proxies `/api` requests to the FastAPI server.

### Optional: enable Gemini fallback

Rules and local embeddings work without a key. To enable the final classification fallback, add your API key to `.env`:

```env
GEMINI_API_KEY=your_key_here
```

`.env` is ignored by Git. If no key is configured, uncertain captures safely retain the best result from the local pipeline.

## Database migrations

MindFlow uses [Alembic](https://alembic.sqlalchemy.org/) for database schema migrations.

### Apply migrations

```bash
cd backend
alembic upgrade head
```

### Create a new migration

After modifying SQLAlchemy models in `app/models.py`:

```bash
cd backend
alembic revision --autogenerate -m "description_of_change"
```

Review the generated migration file in `backend/alembic/versions/`, then apply:

```bash
alembic upgrade head
```

### View migration history

```bash
alembic history --verbose
alembic current
```

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | API health check |
| `POST` | `/items` | Capture an item (`raw_text` is required) |
| `GET` | `/items` | List items; optionally filter by `status` |
| `PATCH` | `/items/{id}` | Manually update an item |
| `DELETE` | `/items/{id}` | Delete an item |
| `POST` | `/items/{id}/complete` | Mark an item complete and optionally submit actual duration |
| `GET/POST/PATCH/DELETE` | `/routine` | Manage recurring routine blocks |
| `GET/PATCH` | `/prefs` | Read or update work preferences |
| `GET` | `/schedule` | Get scheduled slots for a date |
| `POST` | `/schedule/run` | Run the scheduler for a date |
| `GET` | `/suggest/now` | Get the current best-fit suggestion |
| `POST` | `/suggest/action` | Record whether a suggestion was accepted or dismissed |
| `GET` | `/feedback/stats` | View feedback and duration statistics |
| `POST` | `/feedback/recalibrate` | Update duration multipliers from completed work |

## Development

Run the backend test suite:

```bash
cd backend
pytest
```

This runs the fast unit/integration tests using in-memory SQLite. PostgreSQL integration tests run automatically when `DATABASE_URL` points to an available PostgreSQL instance.

Build or lint the frontend:

```bash
cd frontend
npm run build
npm run lint
```

## Project layout

```text
mindFlow/
├── backend/
│   ├── app/
│   │   ├── classification/  # Rules, embeddings, and optional LLM pipeline
│   │   ├── scheduler/       # Scheduling and rescheduling algorithms
│   │   ├── routers/         # FastAPI endpoints
│   │   └── feedback/        # Duration-learning logic
│   ├── alembic/             # Database schema migrations
│   └── tests/               # API, unit, and PostgreSQL integration tests
├── frontend/
│   └── src/                 # React UI, components, and API clients
└── SPEC.md                  # Product and implementation specification
```

## Scope

MindFlow v1 is intentionally single-user and local-first. Authentication, notifications, calendar synchronization, native mobile apps, and collaboration are outside its current scope.

## License

No license has been specified for this repository yet.
