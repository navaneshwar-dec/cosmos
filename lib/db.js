import postgres from 'postgres';

// Use postgres TCP for everything — neon HTTP (fetch-based) is unavailable on this host
const g = globalThis;
if (!g.__sql) {
  g.__sql = postgres(process.env.DATABASE_URL, {
    ssl: 'require',
    max: 5,
    idle_timeout: 30,
    connect_timeout: 20,
  });
}
const sql = g.__sql;

if (!g.__migrated) {
  g.__migrated = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id             SERIAL PRIMARY KEY,
        google_id      TEXT UNIQUE NOT NULL,
        email          TEXT UNIQUE NOT NULL,
        name           TEXT NOT NULL DEFAULT '',
        picture        TEXT NOT NULL DEFAULT '',
        prayer_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        is_admin       BOOLEAN NOT NULL DEFAULT FALSE,
        created_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id),
        text        TEXT NOT NULL,
        date        TIMESTAMPTZ,
        completed   BOOLEAN DEFAULT FALSE,
        recurrence  TEXT,
        labels      TEXT[] DEFAULT '{}',
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    // Google Drive (file storage module) — OAuth tokens + cached root folder, per user
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_access_token  TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_token_expiry  TIMESTAMPTZ`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS drive_root_id        TEXT`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence  TEXT`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS labels     TEXT[] DEFAULT '{}'`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id    INTEGER REFERENCES users(id)`;
    await sql`
      CREATE TABLE IF NOT EXISTS workout_logs (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id),
        log_date    DATE NOT NULL DEFAULT CURRENT_DATE,
        day         TEXT NOT NULL,
        exercise    TEXT NOT NULL,
        started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ended_at    TIMESTAMPTZ,
        sets        JSONB NOT NULL DEFAULT '[]',
        skipped     BOOLEAN NOT NULL DEFAULT FALSE,
        skip_reason TEXT,
        notes       TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, log_date, exercise)
      )
    `;
    await sql`ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)`;
    // older tables shipped UNIQUE(log_date, exercise); the app upserts ON CONFLICT (user_id, log_date, exercise).
    // swap the stale constraint for the user-scoped one so saves stop 500ing.
    await sql`ALTER TABLE workout_logs DROP CONSTRAINT IF EXISTS workout_logs_log_date_exercise_key`;
    await sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workout_logs_user_date_exercise_key') THEN
          ALTER TABLE workout_logs ADD CONSTRAINT workout_logs_user_date_exercise_key UNIQUE (user_id, log_date, exercise);
        END IF;
      END $$;
    `;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS push_notified_at TIMESTAMPTZ`;
    await sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id),
        endpoint    TEXT NOT NULL,
        p256dh      TEXT NOT NULL,
        auth        TEXT NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, endpoint)
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS people (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id),
        name       TEXT NOT NULL,
        color      TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, name)
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS work_items (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id),
        title       TEXT NOT NULL,
        notes       TEXT,
        priority    INTEGER NOT NULL DEFAULT 2,
        deadline    TIMESTAMPTZ,
        assignee_id INTEGER REFERENCES people(id),
        labels      TEXT[] DEFAULT '{}',
        completed   BOOLEAN DEFAULT FALSE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE work_items ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT '{}'`;
    await sql`
      CREATE TABLE IF NOT EXISTS routines (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id),
        title      TEXT NOT NULL,
        time       TEXT,
        days       TEXT[] DEFAULT '{}',
        sort_order INTEGER DEFAULT 0,
        archived   BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS routine_logs (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id),
        routine_id INTEGER REFERENCES routines(id),
        log_date   DATE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, routine_id, log_date)
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS vault_meta (
        user_id     INTEGER PRIMARY KEY REFERENCES users(id),
        salt        TEXT NOT NULL,
        verifier_iv TEXT NOT NULL,
        verifier_ct TEXT NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS vault_entries (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id),
        title      TEXT NOT NULL,
        url        TEXT,
        blob_iv    TEXT NOT NULL,
        blob_ct    TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS diary_entries (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id),
        entry_date DATE NOT NULL,
        mood       TEXT,
        body       TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, entry_date)
      )
    `;
  })().catch(err => { console.error('[db] migration error:', err?.message ?? err); });
}

export async function initDb() {
  await g.__migrated;
}

export default sql;
