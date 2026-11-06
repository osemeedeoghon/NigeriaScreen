import type { MetadataRoute } from "next";
import { indexingAllowed, PRIVATE_PATHS } from "@/lib/seo";
import { getSiteUrl } from "@/lib/supabase/config";

export default function robots(): MetadataRoute.Robots {
  if (!indexingAllowed()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
