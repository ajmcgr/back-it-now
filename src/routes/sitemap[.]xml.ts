import { createFileRoute } from "@tanstack/react-router";
import { publishedBlogArticles } from "@/content/blog";
import { SITE_URL } from "@/lib/seo";
import { publicSupabase } from "@/lib/supabase";

const staticPaths = [
  "/",
  "/discover",
  "/pricing",
  "/faq",
  "/about",
  "/contact",
  "/terms",
  "/privacy",
  "/blog",
  "/tools",
  "/tools/funding-goal-calculator",
  "/tools/crowdfunding-fee-calculator",
  "/tools/reward-price-calculator",
  "/tools/campaign-planner",
  "/compare",
  "/compare/kickstarter",
  "/compare/indiegogo",
  "/compare/patreon",
  "/compare/gofundme",
];

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = new Set(staticPaths.map((path) => new URL(path, SITE_URL).toString()));
        for (const article of publishedBlogArticles) {
          urls.add(new URL(`/blog/${article.slug}`, SITE_URL).toString());
        }
        if (publicSupabase) {
          const [{ data: projects }, { data: profiles }, { data: generatedArticles }] =
            await Promise.all([
              publicSupabase.from("public_profile_projects").select("slug, creator_username"),
              publicSupabase.from("public_profiles").select("username, bio, website, avatar_url"),
              publicSupabase.from("blog_articles").select("slug"),
            ]);
          for (const article of generatedArticles ?? []) {
            if (typeof article.slug === "string") {
              urls.add(new URL(`/blog/${article.slug}`, SITE_URL).toString());
            }
          }
          for (const project of projects ?? []) {
            if (typeof project.slug === "string") {
              urls.add(new URL(`/projects/${project.slug}`, SITE_URL).toString());
            }
          }
          for (const profile of profiles ?? []) {
            const meaningful = Boolean(
              profile.bio ||
              profile.website ||
              profile.avatar_url ||
              (projects ?? []).some((project) => project.creator_username === profile.username),
            );
            if (meaningful && typeof profile.username === "string") {
              urls.add(new URL(`/${profile.username}`, SITE_URL).toString());
            }
          }
        }
        const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...urls].map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n")}
</urlset>`;
        return new Response(body, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
          },
        });
      },
    },
  },
});
