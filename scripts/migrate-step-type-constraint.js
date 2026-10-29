const { neon } = require("@neondatabase/serverless");

const sql = neon(
  "postgresql://neondb_owner:npg_7kQnAvhsMuH8@ep-soft-fog-ap6xo07v.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require"
);

async function migrate() {
  // Drop the existing step_type CHECK constraint and re-add it with 'activity'
  await sql`
    ALTER TABLE course_module_steps
      DROP CONSTRAINT IF EXISTS course_module_steps_step_type_check
  `;
  await sql`
    ALTER TABLE course_module_steps
      ADD CONSTRAINT course_module_steps_step_type_check
      CHECK (step_type IN ('pdf', 'scenarios', 'video', 'mindmap', 'infographic', 'activity', 'quiz'))
  `;
  console.log("Constraint updated — 'activity' added to course_module_steps.step_type CHECK.");

  // Verify
  const rows = await sql`
    SELECT pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'course_module_steps'::regclass AND contype = 'c'
  `;
  console.log("New constraint:", rows[0]?.definition);
}

migrate().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
