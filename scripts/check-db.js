const { neon } = require("@neondatabase/serverless");

const sql = neon(
  "postgresql://neondb_owner:npg_7kQnAvhsMuH8@ep-soft-fog-ap6xo07v.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require"
);

async function check() {
  // 1. Check existing CHECK constraints on course_module_steps
  const constraints = await sql`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'course_module_steps'::regclass
      AND contype = 'c'
  `;
  console.log("Step type constraints:", JSON.stringify(constraints, null, 2));

  // 2. Verify prompt_activity_scores table exists
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'prompt_activity_scores'
  `;
  console.log("prompt_activity_scores table:", tables.length > 0 ? "EXISTS ✓" : "MISSING ✗");
}

check().catch((e) => {
  console.error("Check failed:", e.message);
  process.exit(1);
});
