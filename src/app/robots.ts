import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/reviewer-login/", "/mypage/", "/result/"],
      },
    ],
    sitemap: "https://styledrop.cloud/sitemap.xml",
  };
}
