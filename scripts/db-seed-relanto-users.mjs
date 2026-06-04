/**
 * Seed Relanto @relanto.ai users + two teams (Microsoft SSO — no password login).
 * Run: node scripts/db-seed-relanto-users.mjs
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

function firstNameFromEmail(email) {
  const local = email.split("@")[0] ?? email;
  const segment = local.split(".")[0] ?? local;
  if (!segment) return "Learner";
  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
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

const SSO_PLACEHOLDER = "microsoft-sso";

const batches = [
  {
    id: "relanto_team_1",
    label: "Relanto Team 1",
    description: "Compliance cohort — team one",
    member_count: 3,
  },
  {
    id: "relanto_team_2",
    label: "Relanto Team 2",
    description: "Compliance cohort — team two",
    member_count: 3,
  },
];

const users = [
  {
    email: "deepan.s@relanto.com",
    role: "admin",
    batch_id: null,
  },
  {
    email: "gudivaka.vennela@relanto.ai",
    role: "user",
    batch_id: "relanto_team_1",
  },
  {
    email: "hridyalakshmi.santhosh@relanto.ai",
    role: "user",
    batch_id: "relanto_team_1",
  },
  {
    email: "shreyas.shankar@relanto.ai",
    role: "user",
    batch_id: "relanto_team_1",
  },
  {
    email: "arushi.gupta@relanto.ai",
    role: "user",
    batch_id: "relanto_team_2",
  },
  {
    email: "gaury.jitesh@relanto.ai",
    role: "user",
    batch_id: "relanto_team_2",
  },
  {
    email: "srinithi.v@relanto.ai",
    role: "user",
    batch_id: "relanto_team_2",
  },
];

console.log("Seeding Relanto Microsoft SSO users…");

for (const b of batches) {
  await sql`
    INSERT INTO batches (id, label, description, member_count, compliance, pass_rate, fail_rate, active_sessions)
    VALUES (${b.id}, ${b.label}, ${b.description}, ${b.member_count}, 0, 0, 0, 0)
    ON CONFLICT (id) DO UPDATE SET
      label = EXCLUDED.label,
      description = EXCLUDED.description,
      member_count = EXCLUDED.member_count,
      updated_at = NOW()
  `;
}

for (const u of users) {
  const displayName = firstNameFromEmail(u.email);
  await sql`
    INSERT INTO users (email, password_hash, role, batch_id, display_name)
    VALUES (${u.email}, ${SSO_PLACEHOLDER}, ${u.role}, ${u.batch_id}, ${displayName})
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      role = EXCLUDED.role,
      batch_id = EXCLUDED.batch_id,
      display_name = EXCLUDED.display_name,
      updated_at = NOW()
  `;
  console.log(`  ✓ ${displayName} <${u.email}> → ${u.batch_id} (${u.role})`);
}

console.log("\n✅ Relanto users ready. Sign in at /login with Continue with Microsoft.");
