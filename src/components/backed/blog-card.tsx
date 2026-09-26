import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { formatBlogDate, type BlogArticle } from "@/content/blog";
import { BLOG_FALLBACK_IMAGE } from "@/lib/blog-images";

export function BlogCard({ article, image }: { article: BlogArticle; image: string }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      <Link
        to="/blog/$slug"
        params={{ slug: article.slug }}
        className="block aspect-[16/9] overflow-hidden bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <img
          src={image}
          alt=""
          width={1200}
          height={675}
          loading="lazy"
          className={
            image === BLOG_FALLBACK_IMAGE
              ? "h-full w-full object-contain p-10"
              : "h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          }
        />
      </Link>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          {article.category}
        </p>
        <h2 className="mt-3 text-xl font-semibold leading-tight sm:text-2xl">
          <Link
            to="/blog/$slug"
            params={{ slug: article.slug }}
            className="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {article.title}
          </Link>
        </h2>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
          {article.excerpt}
        </p>
        <div className="mt-auto flex items-end justify-between gap-4 pt-6">
          <p className="text-xs leading-5 text-muted-foreground">
            {article.author} · {formatBlogDate(article.publishedAt)} · {article.readMinutes} min
            read
          </p>
          <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </div>
      </div>
    </article>
  );
}
