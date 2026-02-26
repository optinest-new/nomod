import { getCmsContent, type SiteConfig } from "@/lib/cms";

export async function getSiteConfig(): Promise<SiteConfig> {
  return (await getCmsContent()).siteConfig;
}
