import { NextResponse, type NextRequest } from "next/server";
import { deleteExpiredLinks } from "~/server/api/link";
import { deleteExpiredUserLinks } from "~/server/api/user-link";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;

  // Fail closed: a missing secret must never authorize "Bearer undefined".
  if (!secret) return false;

  return req.headers.get("Authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await deleteExpiredUserLinks();
  await deleteExpiredLinks();

  return NextResponse.json({ message: "success" });
}
