import { publishedBlogArticles, type BlogArticle } from "@/content/blog";
import { publicSupabase } from "@/lib/supabase";

type GeneratedArticleRow = {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  category: BlogArticle["category"];
  author: string;
  published_at: string;
  updated_at: string;
  read_minutes: number;
  image_concept: string;
  image_url: string;
  sections: BlogArticle["sections"];
  related_links: BlogArticle["relatedLinks"];
  sources: BlogArticle["sources"];
};

function dateOnly(value: string) {
  return value.slice(0, 10);
}

function mapGeneratedArticle(row: GeneratedArticleRow): BlogArticle {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    excerpt: row.excerpt,
    category: row.category,
    author: row.author,
    publishedAt: dateOnly(row.published_at),
    updatedAt: dateOnly(row.updated_at),
    readMinutes: row.read_minutes,
    draft: false,
    imageConcept: row.image_concept,
    imageUrl: row.image_url,
    sections: row.sections,
    relatedLinks: row.related_links,
    sources: row.sources,
  };
}

export async function loadPublishedBlogArticles() {
  if (!publicSupabase) return publishedBlogArticles;

  const { data, error } = await publicSupabase
    .from("blog_articles")
    .select(
      "slug, title, description, excerpt, category, author, published_at, updated_at, read_minutes, image_concept, image_url, sections, related_links, sources",
    )
    .order("published_at", { ascending: false });

  if (error) return publishedBlogArticles;

  const generated = (data ?? []).map((row) => mapGeneratedArticle(row as GeneratedArticleRow));
  const articlesBySlug = new Map<string, BlogArticle>();
  for (const article of [...publishedBlogArticles, ...generated]) {
    articlesBySlug.set(article.slug, article);
  }
  return [...articlesBySlug.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function loadPublishedBlogArticle(slug: string) {
  const articles = await loadPublishedBlogArticles();
  return articles.find((article) => article.slug === slug) ?? null;
}
