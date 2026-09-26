import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBlogDate, getBlogArticle } from "@/content/blog";
import { BLOG_FALLBACK_IMAGE, loadBlogImages, resolveBlogImage } from "@/lib/blog-images";
import { absoluteUrl, publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const article = getBlogArticle(params.slug);
    if (!article) throw notFound();
    const images = await loadBlogImages();
    return { article, image: resolveBlogImage(images, article.slug) };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { article, image } = loaderData;
    const path = `/blog/${article.slug}`;
    return publicSeo({
      title: `${article.title} | Backed`,
      description: article.description,
      path,
      image,
      type: "article",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: article.title,
        description: article.description,
        image,
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        author: { "@type": "Organization", name: article.author, url: absoluteUrl("/about") },
        publisher: { "@type": "Organization", name: "Backed", url: absoluteUrl("/") },
        mainEntityOfPage: absoluteUrl(path),
      },
    });
  },
  component: BlogArticlePage,
});

function BlogArticlePage() {
  const { article, image } = Route.useLoaderData();

  return (
    <main>
      <article className="container-backed py-10 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link to="/blog" className="inline-flex items-center gap-1.5 hover:text-foreground">
              <ArrowLeft className="size-4" /> Blog
            </Link>
          </nav>
          <p className="mt-9 text-sm font-semibold uppercase tracking-[0.12em] text-primary">
            {article.category}
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.08] sm:text-5xl">
            {article.title}
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">{article.description}</p>
          <p className="mt-5 text-sm text-muted-foreground">
            By {article.author} · {formatBlogDate(article.publishedAt)} · {article.readMinutes} min
            read
          </p>
        </div>

        <div className="mx-auto mt-10 aspect-[16/9] max-w-5xl overflow-hidden rounded-xl border border-border bg-muted sm:mt-12">
          <img
            src={image}
            alt={`Editorial cover for ${article.title}`}
            width={1536}
            height={864}
            className={
              image === BLOG_FALLBACK_IMAGE
                ? "h-full w-full object-contain p-12 sm:p-20"
                : "h-full w-full object-cover"
            }
          />
        </div>

        <div className="mx-auto mt-12 max-w-3xl sm:mt-16">
          <div className="space-y-11">
            {article.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-2xl font-semibold leading-tight sm:text-3xl">
                  {section.heading}
                </h2>
                <div className="mt-4 space-y-5 text-base leading-8 text-foreground/90 sm:text-lg">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {section.bullets ? (
                    <ul className="list-disc space-y-2 pl-6 marker:text-primary">
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </section>
            ))}
          </div>

          {article.sources?.length ? (
            <section className="mt-12 rounded-xl border border-border bg-muted/40 p-5 sm:p-6">
              <h2 className="text-base font-semibold">Official sources</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {article.sources.map((source) => (
                  <li key={source.href}>
                    <a
                      href={source.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 underline underline-offset-4 hover:text-foreground"
                    >
                      {source.label} <ExternalLink className="size-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-12 border-t border-border pt-9">
            <h2 className="text-xl font-semibold">Keep reading</h2>
            <div className="mt-4 grid gap-3">
              {article.relatedLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border p-4 font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {link.label} <ArrowRight className="size-4 shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </article>

      <section className="border-t border-border bg-muted/35 px-4 py-14 text-center sm:py-18">
        <h2 className="text-3xl font-semibold">Have something worth backing?</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Build your project page for free and share it when you are ready.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link to="/start">Start a project</Link>
        </Button>
      </section>
    </main>
  );
}
