import { getSql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "Email and password are required." },
        { status: 400 },
      );
    }

    const sql = getSql();
    const rows = await sql`
      SELECT email, password_hash, role, batch_id
      FROM users
      WHERE LOWER(email) = LOWER(${email.trim()})
      LIMIT 1
    `;

    if (rows.length === 0 || rows[0].password_hash !== password) {
      return NextResponse.json(
        { ok: false, error: "Invalid email or password." },
        { status: 401 },
      );
    }

    const u = rows[0];
    return NextResponse.json({
      ok: true,
      user: {
        username: u.email,
        role: u.role,
        batchId: u.batch_id ?? "",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
