-- Prompt Engineering Activity Scores
-- NEW standalone table — does NOT touch any existing tables.
-- Run via: npm run db:migrate:activity  (or apply manually in Neon console)

CREATE TABLE IF NOT EXISTS prompt_activity_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email      TEXT NOT NULL,
  module_id       TEXT NOT NULL,
  -- which of the 4 activities: block-builder | robot-rescue | ingredient-lab | sprint-challenge
  activity_id     TEXT NOT NULL CHECK (activity_id IN (
                    'block-builder', 'robot-rescue', 'ingredient-lab', 'sprint-challenge'
                  )),
  score           INTEGER NOT NULL DEFAULT 0,
  max_score       INTEGER NOT NULL DEFAULT 25,
  attempt_number  INTEGER NOT NULL DEFAULT 1,
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- No FK to course_modules — keeps it fully isolated and safe from course deletions
  UNIQUE (user_email, module_id, activity_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_prompt_act_user     ON prompt_activity_scores(user_email);
CREATE INDEX IF NOT EXISTS idx_prompt_act_module   ON prompt_activity_scores(module_id);
CREATE INDEX IF NOT EXISTS idx_prompt_act_activity ON prompt_activity_scores(activity_id);
CREATE INDEX IF NOT EXISTS idx_prompt_act_completed ON prompt_activity_scores(completed_at DESC);
