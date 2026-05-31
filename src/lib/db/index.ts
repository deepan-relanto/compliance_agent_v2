import { neon } from "@neondatabase/serverless";

export function getDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL?.trim() ||
    process.env.postgres_neon?.trim() ||
    process.env.POSTGRES_NEON?.trim();

  if (!url) {
    throw new Error(
      "Missing DATABASE_URL (or postgres_neon) in environment variables.",
    );
  }
  return url;
}

export function getSql() {
  return neon(getDatabaseUrl());
}
