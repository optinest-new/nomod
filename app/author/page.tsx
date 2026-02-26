import { redirect } from "next/navigation";

export default function AuthorRedirectPage() {
  redirect("/authors");
}
