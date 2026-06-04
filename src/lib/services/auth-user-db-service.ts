import type { getSql } from "@/lib/db";
import { firstNameFromEmail } from "@/lib/auth-env";
import type { AuthUser, UserRole } from "@/lib/types";

type Sql = ReturnType<typeof getSql>;

export type DbAuthUser = {
  email: string;
  role: UserRole;
  batch_id: string | null;
  display_name: string | null;
};

export async function getUserByEmail(
  sql: Sql,
  email: string,
): Promise<DbAuthUser | null> {
  const rows = await sql`
    SELECT email, role, batch_id, display_name
    FROM users
    WHERE LOWER(email) = LOWER(${email.trim()})
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    email: r.email as string,
    role: r.role as UserRole,
    batch_id: (r.batch_id as string) ?? null,
    display_name: (r.display_name as string) ?? null,
  };
}

export function toAuthUser(db: DbAuthUser): AuthUser {
  return {
    username: db.email,
    role: db.role,
    batchId: db.batch_id ?? "",
    displayName:
      db.display_name?.trim() || firstNameFromEmail(db.email),
  };
}
