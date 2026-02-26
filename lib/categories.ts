import { readSupabaseJson, supabaseRequest } from "@/lib/supabase";

const defaultCategories = ["Lifestyle", "Design", "Technology"];

type CategoryRow = {
  name: string;
};

function sanitizeCategories(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const values = input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }

      const record = item as Partial<CategoryRow>;
      return typeof record.name === "string" ? record.name.trim() : "";
    })
    .filter(Boolean);

  return Array.from(new Set(values));
}

export async function getCategories(): Promise<string[]> {
  try {
    const response = await supabaseRequest("/rest/v1/categories", {
      query: {
        select: "name",
        order: "name.asc",
      },
    });

    const rows = await readSupabaseJson<CategoryRow[]>(response);
    const categories = sanitizeCategories(rows);
    return categories.length > 0 ? categories : defaultCategories;
  } catch {
    return defaultCategories;
  }
}

export async function saveCategories(categories: string[]): Promise<void> {
  const normalized = Array.from(
    new Set(
      categories
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

  if (normalized.length === 0) {
    throw new Error("Categories cannot be empty.");
  }

  const upsertResponse = await supabaseRequest("/rest/v1/categories", {
    method: "POST",
    query: {
      on_conflict: "name",
    },
    prefer: "resolution=merge-duplicates,return=minimal",
    body: normalized.map((name) => ({ name })),
  });
  await readSupabaseJson(upsertResponse);

  const existing = await getCategories();
  const toDelete = existing.filter((name) => !normalized.includes(name));

  for (const name of toDelete) {
    const deleteResponse = await supabaseRequest("/rest/v1/categories", {
      method: "DELETE",
      query: {
        name: `eq.${name}`,
      },
    });
    await readSupabaseJson(deleteResponse);
  }
}
