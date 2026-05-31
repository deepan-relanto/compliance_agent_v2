/**
 * Minimal seed: batches + users only. Assessments come from admin uploads.
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
  console.error("❌ Set DATABASE_URL or postgres_neon in .env");
  process.exit(1);
}

const sql = neon(url);

const batches = [
  {
    id: "batch_a",
    label: "Batch A — Engineering",
    description: "Product & platform engineering",
    member_count: 5,
    compliance: 0,
    pass_rate: 0,
    fail_rate: 0,
    active_sessions: 0,
  },
  {
    id: "batch_b",
    label: "Batch B — Operations",
    description: "Field operations & logistics",
    member_count: 4,
    compliance: 0,
    pass_rate: 0,
    fail_rate: 0,
    active_sessions: 0,
  },
  {
    id: "batch_c",
    label: "Batch C — Sales",
    description: "Revenue and customer-facing teams",
    member_count: 3,
    compliance: 0,
    pass_rate: 0,
    fail_rate: 0,
    active_sessions: 0,
  },
];

const users = [
  { email: "admin@relnto.com", password: "admin123", role: "admin", batch_id: null },
  { email: "user1@relnto.com", password: "user123", role: "user", batch_id: "batch_a" },
  { email: "user2@relnto.com", password: "user123", role: "user", batch_id: "batch_a" },
  { email: "user3@relnto.com", password: "user123", role: "user", batch_id: "batch_b" },
  { email: "user4@relnto.com", password: "user123", role: "user", batch_id: "batch_b" },
  { email: "user5@relnto.com", password: "user123", role: "user", batch_id: "batch_c" },
  { email: "user6@relnto.com", password: "user123", role: "user", batch_id: "batch_c" },
  { email: "user7@relnto.com", password: "user123", role: "user", batch_id: "batch_a" },
  { email: "user8@relnto.com", password: "user123", role: "user", batch_id: "batch_c" },
];

console.log("Seeding Neon (batches + users only)…");

for (const b of batches) {
  await sql`
    INSERT INTO batches (id, label, description, member_count, compliance, pass_rate, fail_rate, active_sessions)
    VALUES (${b.id}, ${b.label}, ${b.description}, ${b.member_count}, ${b.compliance}, ${b.pass_rate}, ${b.fail_rate}, ${b.active_sessions})
    ON CONFLICT (id) DO UPDATE SET
      label = EXCLUDED.label,
      description = EXCLUDED.description,
      member_count = EXCLUDED.member_count,
      updated_at = NOW()
  `;
}

for (const u of users) {
  await sql`
    INSERT INTO users (email, password_hash, role, batch_id, display_name)
    VALUES (${u.email}, ${u.password}, ${u.role}, ${u.batch_id}, ${u.email})
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      role = EXCLUDED.role,
      batch_id = EXCLUDED.batch_id,
      updated_at = NOW()
  `;
}

console.log("✅ Seed complete.");
