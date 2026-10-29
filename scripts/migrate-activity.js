const { neon } = require("@neondatabase/serverless");

const sql = neon(
  "postgresql://neondb_owner:npg_7kQnAvhsMuH8@ep-soft-fog-ap6xo07v.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require"
);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS prompt_activity_scores (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_email      TEXT NOT NULL,
      module_id       TEXT NOT NULL,
      activity_id     TEXT NOT NULL CHECK (activity_id IN (
                        'block-builder','robot-rescue','ingredient-lab','sprint-challenge'
                      )),
      score           INTEGER NOT NULL DEFAULT 0,
      max_score       INTEGER NOT NULL DEFAULT 25,
      attempt_number  INTEGER NOT NULL DEFAULT 1,
      completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_email, module_id, activity_id, attempt_number)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_prompt_act_user     ON prompt_activity_scores(user_email)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_prompt_act_module   ON prompt_activity_scores(module_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_prompt_act_activity ON prompt_activity_scores(activity_id)`;
  console.log("Migration OK — prompt_activity_scores table ready.");
}

migrate().catch((e) => {
  console.error("Migration FAILED:", e.message);
  process.exit(1);
});
