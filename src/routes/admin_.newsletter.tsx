import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminLoading, AdminShell, AdminUnavailable } from "@/components/backed/admin-shell";
import { Button } from "@/components/ui/button";
import {
  invokeAdmin,
  type AdminNewsletterPeriod,
  type AdminNewsletterProject,
  type AdminNewsletterResponse,
} from "@/lib/admin";
import { privateSeo } from "@/lib/seo";

export const Route = createFileRoute("/admin_/newsletter")({
  head: () => privateSeo("Newsletter — Backed Admin"),
  component: AdminNewsletter,
});

const sections = [
  { key: "trending", title: "🔥 Trending", newsletterTitle: "🔥 Trending" },
  { key: "latest", title: "🆕 Latest", newsletterTitle: "🆕 New on Backed" },
  { key: "mostBacked", title: "💰 Most Backed", newsletterTitle: "💰 Most backed" },
  { key: "mostFavorited", title: "❤️ Most Favorited", newsletterTitle: "❤️ Most favorited" },
  { key: "mostDiscussed", title: "💬 Most Discussed", newsletterTitle: "💬 Most discussed" },
] as const;

const formatMoney = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);

function firstParagraph(value: string) {
  return value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .find(Boolean);
}

function projectText(project: AdminNewsletterProject) {
  const description = firstParagraph(project.description);
  return [
    project.name,
    project.summary || null,
    description && description !== project.summary ? description : null,
    `${formatMoney(project.backed_amount)} backed`,
    project.url,
  ]
    .filter(Boolean)
    .join("\n");
}

function sectionText(title: string, projects: AdminNewsletterProject[]) {
  if (projects.length === 0) return "";
  return [title, ...projects.map(projectText)].join("\n\n");
}

function newsletterText(response: AdminNewsletterResponse) {
  const content = sections.flatMap((section) => {
    const text = sectionText(section.newsletterTitle, response.sections[section.key]);
    return text ? [text] : [];
  });
  return [
    "This week on Backed",
    "Here are some of the things people are backing into existence this week.",
    ...content,
    "Back things you want to exist.\n\nhttps://backedit.co",
  ].join("\n\n");
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

function AdminNewsletter() {
  const [period, setPeriod] = useState<AdminNewsletterPeriod>("week");
  const [response, setResponse] = useState<AdminNewsletterResponse | null>(null);
  const [denied, setDenied] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let cancelled = false;
    setResponse(null);
    void invokeAdmin<AdminNewsletterResponse>("newsletter_projects", { period })
      .then((data) => {
        if (!cancelled) setResponse(data);
      })
      .catch(() => {
        if (!cancelled) setDenied(true);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const projectCount = useMemo(
    () =>
      response
        ? sections.reduce((total, section) => total + response.sections[section.key].length, 0)
        : 0,
    [response],
  );

  async function copy(value: string, key: string) {
    try {
      await copyText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? "" : current)), 1800);
    } catch {
      setCopied("");
    }
  }

  if (denied) return <AdminUnavailable message="You don’t have access to Backed Admin." />;
  if (!response) return <AdminLoading />;

  return (
    <AdminShell
      active="newsletter"
      title="Newsletter"
      description="Projects ready to feature in the Backed newsletter."
    >
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-3 text-sm font-medium">
          Period
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as AdminNewsletterPeriod)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="week">This week</option>
            <option value="month">Past 30 days</option>
            <option value="all">All time</option>
          </select>
        </label>
        <Button
          onClick={() => void copy(newsletterText(response), "newsletter")}
          disabled={projectCount === 0}
        >
          {copied === "newsletter" ? <Check /> : <Copy />}
          {copied === "newsletter" ? "Copied" : "Copy Newsletter"}
        </Button>
      </div>

      <div className="space-y-10">
        {sections.map((section) => {
          const projects = response.sections[section.key];
          return (
            <section key={section.key}>
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">{section.title}</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void copy(sectionText(section.title, projects), `section-${section.key}`)
                  }
                  disabled={projects.length === 0}
                >
                  {copied === `section-${section.key}` ? <Check /> : <Copy />}
                  {copied === `section-${section.key}` ? "Copied" : "Copy All"}
                </Button>
              </div>

              {projects.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-7 text-center text-sm text-muted-foreground">
                  No projects yet.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  {projects.map((project) => (
                    <article
                      key={project.slug}
                      className="flex flex-col gap-5 border-b border-border p-4 last:border-0 sm:flex-row sm:p-5"
                    >
                      <div className="aspect-[16/10] w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:w-44">
                        {project.image_url ? (
                          <img
                            src={project.image_url}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold">{project.name}</h3>
                          {project.status === "prelaunch" ? (
                            <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              Coming soon
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          by {project.creator_name}
                          {project.category ? ` · ${project.category}` : ""}
                        </p>
                        {project.summary ? (
                          <p className="mt-3 text-sm leading-6">{project.summary}</p>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
                          <span>{formatMoney(project.backed_amount)} backed</span>
                          <span>{project.backer_count} backers</span>
                          <span>{project.favorite_count} favorites</span>
                          <span>{project.comment_count} comments</span>
                        </div>
                        <p className="mt-3 truncate text-xs text-muted-foreground">{project.url}</p>
                      </div>
                      <div className="flex shrink-0 items-start gap-2 sm:flex-col">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void copy(projectText(project), `project-${project.slug}`)}
                        >
                          {copied === `project-${project.slug}` ? <Check /> : <Copy />}
                          {copied === `project-${project.slug}` ? "Copied" : "Copy"}
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={project.url} target="_blank" rel="noreferrer">
                            Open <ExternalLink />
                          </a>
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </AdminShell>
  );
}
