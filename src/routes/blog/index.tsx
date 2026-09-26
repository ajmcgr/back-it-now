import { createFileRoute } from "@tanstack/react-router";
import { BlogCard } from "@/components/backed/blog-card";
import { publishedBlogArticles } from "@/content/blog";
import { loadBlogImages, resolveBlogImage } from "@/lib/blog-images";
import { absoluteUrl, publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/blog/")({
  loader: async () => ({ images: await loadBlogImages() }),
  head: () =>
    publicSeo({
      title: "Crowdfunding Guides and Ideas | Backed Blog",
      description:
        "Practical guides, platform comparisons and ideas for creators building crowdfunded products and creative projects.",
      path: "/blog",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: "Backed Blog",
        url: absoluteUrl("/blog"),
        description:
          "Practical guides, platform comparisons and ideas for creators building crowdfunded products and creative projects.",
        publisher: { "@type": "Organization", name: "Backed", url: absoluteUrl("/") },
      },
    }),
  component: BlogIndex,
});

function BlogIndex() {
  const { images } = Route.useLoaderData();

  return (
    <main className="container-backed py-14 sm:py-20">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
          Backed Blog
        </p>
        <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">Make ideas worth backing</h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Practical crowdfunding guides, honest platform comparisons and useful lessons for
          independent creators.
        </p>
      </header>

      <section className="mt-12 grid gap-6 md:grid-cols-2 lg:mt-16" aria-label="Blog articles">
        {publishedBlogArticles.map((article) => (
          <BlogCard
            key={article.slug}
            article={article}
            image={resolveBlogImage(images, article.slug)}
          />
        ))}
      </section>
    </main>
  );
}
