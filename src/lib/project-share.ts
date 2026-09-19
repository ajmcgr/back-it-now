import { supabase } from "@/lib/supabase";

export type ShareContext =
  "owner_launch" | "owner_general" | "backer" | "visitor" | "project_update";

export type ShareProject = {
  slug: string;
  name: string;
  summary: string;
};

const BASE_URL = "https://backedit.co";

export const projectUrl = (slug: string) => `${BASE_URL}/projects/${slug}`;

export function shareCopy(project: ShareProject, context: ShareContext) {
  const url = projectUrl(project.slug);
  const summary = project.summary.trim();
  const owner = context === "owner_launch" || context === "owner_general";
  if (owner)
    return `I'm raising for ${project.name} on Backed.\n\n${summary}\n\nBack it here:\n${url}`;
  if (context === "backer")
    return `I'm backing ${project.name} on Backed.\n\n${summary}\n\nHelp make it happen:\n${url}`;
  return `Check out ${project.name} on Backed.\n\n${summary}\n\n${url}`;
}

export function shareUrls(project: ShareProject, context: ShareContext) {
  const url = projectUrl(project.slug);
  const copy = shareCopy(project, context);
  const withUtm = (source: string) =>
    `${url}?utm_source=${encodeURIComponent(source)}&utm_medium=social&utm_campaign=project_share`;
  return {
    url,
    copy,
    x: `https://x.com/intent/post?text=${encodeURIComponent(shareCopy(project, context).replace(url, withUtm("x")))}`,
    reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(withUtm("reddit"))}&title=${encodeURIComponent(`${project.name}: ${project.summary}`)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(withUtm("linkedin"))}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(shareCopy(project, context).replace(url, withUtm("whatsapp")))}`,
  };
}

export function trackShare(slug: string, event: string, context: ShareContext) {
  if (!supabase) return;
  void supabase.functions
    .invoke("project-share", { body: { slug, event, context } })
    .catch(() => undefined);
}
