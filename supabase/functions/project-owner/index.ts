import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { sanitizeGalleryMedia, storedGalleryMedia } from "../_shared/project-gallery.ts";

const cors = {
  "Access-Control-Allow-Origin": "https://backedit.co",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const categories = new Set([
  "Technology",
  "Design",
  "Fashion",
  "Games",
  "Publishing",
  "Food",
  "Other",
]);
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const bounded = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const isHttpsUrl = (value: string) => !value || /^https:\/\/[^\s]+$/i.test(value);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "authentication_required" });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return reply(401, { error: "authentication_required" });

  try {
    const body = await request.json();
    const slug = typeof body.slug === "string" ? body.slug : "";
    const { data: project, error } = await admin
      .from("projects")
      .select(
        "id, slug, name, summary, description, image_url, gallery_media, category, external_website, location, project_dates, funding_goal_amount, deadline_at, successful_backed_amount, successful_backer_count, creator_archived_at, status",
      )
      .eq("slug", slug)
      .eq("creator_id", auth.user.id)
      .maybeSingle();
    if (error || !project) return reply(404, { error: "project_not_found" });

    const { data: reward } = await admin
      .from("rewards")
      .select("id, title, description, amount, total_quantity, claimed_quantity, reserved_quantity")
      .eq("project_id", project.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (body.action === "get") return reply(200, { project, reward });

    if (body.action === "archive") {
      const { count } = await admin
        .from("backings")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project.id);
      if (
        (count ?? 0) > 0 ||
        project.successful_backed_amount > 0 ||
        project.successful_backer_count > 0
      )
        return reply(409, { error: "projects_with_financial_history_cannot_be_archived" });
      await admin
        .from("projects")
        .update({ creator_archived_at: new Date().toISOString() })
        .eq("id", project.id);
      return reply(200, { archived: true });
    }

    if (body.action !== "update") return reply(400, { error: "unknown_action" });
    if (project.creator_archived_at) return reply(409, { error: "archived_project" });

    const name = bounded(body.name, 160);
    const summary = bounded(body.summary, 500);
    const description = bounded(body.description, 10000);
    const category = bounded(body.category, 40) || "Other";
    const externalWebsite = bounded(body.externalWebsite, 500);
    const imageUrl = bounded(body.imageUrl, 2000);
    const projectMediaPrefix = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/project-media/projects/${project.id}/`;
    const isOwnedMedia = (value: string) =>
      value.startsWith(projectMediaPrefix) || value.startsWith("https://backedit.co/");
    const storagePublicPrefix = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/project-media/`;
    const galleryMedia = sanitizeGalleryMedia(body.galleryMedia, {
      imagePathPrefix: `projects/${project.id}/`,
      storagePublicPrefix,
      allowBackedAssets: true,
    });
    if (
      name.length < 3 ||
      summary.length < 3 ||
      !categories.has(category) ||
      !isHttpsUrl(externalWebsite) ||
      !imageUrl ||
      !isOwnedMedia(imageUrl) ||
      galleryMedia === null
    )
      return reply(422, { error: "invalid_project_presentation" });

    const updates: Record<string, unknown> = {
      name,
      summary,
      description,
      category,
      external_website: externalWebsite || null,
      image_url: imageUrl || null,
      gallery_media: galleryMedia,
      location: bounded(body.location, 160) || null,
      project_dates: bounded(body.projectDates, 160) || null,
    };
    const backed = project.successful_backed_amount > 0 || project.successful_backer_count > 0;
    if (!backed) {
      const goal = Number(body.goal);
      const price = Number(body.rewardPrice);
      const quantity = Number(body.rewardQuantity);
      const deadline = typeof body.deadline === "string" ? new Date(body.deadline) : null;
      if (
        !Number.isFinite(goal) ||
        goal < 1 ||
        !Number.isFinite(price) ||
        price < 1 ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        !deadline ||
        deadline <= new Date()
      )
        return reply(422, { error: "invalid_project_economics" });
      if (reward && quantity < reward.claimed_quantity + reward.reserved_quantity)
        return reply(422, { error: "reward_capacity_below_claimed_or_reserved" });
      updates.funding_goal_amount = Math.round(goal * 100);
      updates.deadline_at = deadline.toISOString();
      if (reward) {
        const rewardName = bounded(body.rewardName, 160);
        if (rewardName.length < 2) return reply(422, { error: "invalid_reward" });
        await admin
          .from("rewards")
          .update({
            title: rewardName,
            description: bounded(body.rewardDescription, 2000),
            amount: Math.round(price * 100),
            total_quantity: quantity,
          })
          .eq("id", reward.id)
          .eq("project_id", project.id);
      }
    }
    const { error: updateError } = await admin
      .from("projects")
      .update(updates)
      .eq("id", project.id)
      .eq("creator_id", auth.user.id);
    if (updateError) return reply(500, { error: "project_update_failed" });
    const retainedPaths = new Set(
      galleryMedia.flatMap((item) =>
        item.type === "image" && item.storagePath ? [item.storagePath] : [],
      ),
    );
    if (imageUrl.startsWith(storagePublicPrefix)) {
      const coverPath = decodeURIComponent(imageUrl.slice(storagePublicPrefix.length));
      if (coverPath.startsWith(`projects/${project.id}/`)) retainedPaths.add(coverPath);
    }
    const removedPaths = storedGalleryMedia(project.gallery_media).flatMap((item) =>
      item.type === "image" &&
      item.storagePath?.startsWith(`projects/${project.id}/`) &&
      !retainedPaths.has(item.storagePath)
        ? [item.storagePath]
        : [],
    );
    if (removedPaths.length) await admin.storage.from("project-media").remove(removedPaths);
    return reply(200, { updated: true, restrictedEconomics: backed });
  } catch {
    return reply(400, { error: "invalid_project_request" });
  }
});
