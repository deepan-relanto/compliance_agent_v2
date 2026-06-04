/**
 * Adds columns introduced after initial schema (safe to re-run).
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  try {
    const raw = readFileSync(join(root, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const url =
  process.env.DATABASE_URL?.trim() ||
  process.env.postgres_neon?.trim() ||
  process.env.POSTGRES_NEON?.trim();

if (!url) {
  console.error("❌ Set DATABASE_URL in .env");
  process.exit(1);
}

const sql = neon(url);

await sql`ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS content_hash TEXT`;
await sql`ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS mcq_generation_status TEXT NOT NULL DEFAULT 'pending'`;

await sql`ALTER TABLE mcq_questions ADD COLUMN IF NOT EXISTS explanation TEXT`;
await sql`
  UPDATE mcq_questions
  SET explanation = 'This checks whether the learner applies the approved compliance process instead of taking an unsafe shortcut.'
  WHERE explanation IS NULL OR btrim(explanation) = ''
`;

await sql`ALTER TABLE assessment_progress ADD COLUMN IF NOT EXISTS mcq_correct INTEGER NOT NULL DEFAULT 0`;
await sql`ALTER TABLE assessment_progress ADD COLUMN IF NOT EXISTS mcq_total INTEGER NOT NULL DEFAULT 0`;
await sql`ALTER TABLE assessment_progress ADD COLUMN IF NOT EXISTS score_percent INTEGER`;
await sql`ALTER TABLE assessment_progress ADD COLUMN IF NOT EXISTS mcq_answers JSONB NOT NULL DEFAULT '{}'::jsonb`;

await sql`ALTER TABLE upload_files ADD COLUMN IF NOT EXISTS module_id TEXT REFERENCES training_modules(id) ON DELETE SET NULL`;
await sql`ALTER TABLE upload_files ADD COLUMN IF NOT EXISTS content_hash TEXT`;

console.log("✅ Schema alterations applied.");
