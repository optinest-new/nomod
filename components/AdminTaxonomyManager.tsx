"use client";

import { useState } from "react";

import { addCategoryAction, updateCategoryAction } from "@/app/admin/actions";

type AdminTaxonomyManagerProps = {
  categories: string[];
};

export function AdminTaxonomyManager({ categories }: AdminTaxonomyManagerProps) {
  const [selectedCategory, setSelectedCategory] = useState(categories[0] ?? "");

  return (
    <div className="admin-taxonomy-grid">
      <section className="admin-card admin-taxonomy-card">
        <h2>Categories</h2>

        <form action={addCategoryAction} className="admin-form admin-taxonomy-form">
          <label>
            Add category
            <input name="name" placeholder="e.g. Creativity" required />
          </label>
          <button type="submit" className="pill-button admin-taxonomy-button">
            Add category
          </button>
        </form>

        <form action={updateCategoryAction} className="admin-form admin-taxonomy-form">
          <label>
            Current category
            <select
              name="previousName"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              required
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label>
            New category name
            <input name="nextName" defaultValue={selectedCategory} required key={selectedCategory} />
          </label>

          <button type="submit" className="pill-button admin-taxonomy-button">
            Update category
          </button>
        </form>
      </section>
    </div>
  );
}
