import { NextResponse } from "next/server";

import { isAdminSession } from "@/lib/admin";
import { getNewsletterSubscribers } from "@/lib/newsletter";

function escapeCsvCell(value: string): string {
  const normalized = value.replace(/\r?\n/g, " ").trim();

  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

export async function GET(request: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const searchQuery = String(searchParams.get("q") ?? "").trim().toLowerCase();

  const subscribers = await getNewsletterSubscribers();
  const rows = searchQuery
    ? subscribers.filter((entry) =>
        [entry.email, entry.sourcePath ?? "", entry.submittedAt]
          .join(" ")
          .toLowerCase()
          .includes(searchQuery),
      )
    : subscribers;

  const csvHeader = "id,email,sourcePath,submittedAt";
  const csvRows = rows.map((entry) =>
    [
      escapeCsvCell(entry.id),
      escapeCsvCell(entry.email),
      escapeCsvCell(entry.sourcePath ?? ""),
      escapeCsvCell(entry.submittedAt),
    ].join(","),
  );

  const csv = `${csvHeader}\n${csvRows.join("\n")}`;
  const datePart = new Date().toISOString().slice(0, 10);
  const fileName = searchQuery
    ? `newsletter-subscribers-filtered-${datePart}.csv`
    : `newsletter-subscribers-${datePart}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${fileName}\"`,
      "Cache-Control": "no-store",
    },
  });
}
