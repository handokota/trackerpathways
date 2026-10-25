import type { MetadataRoute } from "next";

const siteUrl = "https://trackerpathways.org";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/directory`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/map`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
