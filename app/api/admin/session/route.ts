import { NextResponse } from "next/server";

import { getCurrentAdminUser } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentAdminUser();

  return NextResponse.json(
    {
      authenticated: Boolean(user),
      role: user?.role ?? null,
      name: user?.name ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
