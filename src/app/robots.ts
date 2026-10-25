import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/directory", "/map"],
      disallow: ["/api/", "/*?*"],
    },
    sitemap: "https://trackerpathways.org/sitemap.xml",
    host: "https://trackerpathways.org",
  };
}
