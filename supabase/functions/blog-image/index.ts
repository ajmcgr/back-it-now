import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const productionOrigin = "https://backedit.co";
const ownerAdminUserId = "ce29db8a-c666-4688-9cc9-dbbfead8bbfc";
const bucket = "blog-images";
const model = "gpt-image-2.5-flare";

const concepts: Record<string, { title: string; concept: string }> = {
  "how-to-crowdfund-a-project-in-2026": {
    title: "How to Crowdfund a Project in 2026",
    concept:
      "an independent creator planning a launch with sketches, a prototype and a simple campaign checklist",
  },
  "kickstarter-vs-patreon": {
    title: "Kickstarter vs Patreon: What’s the Difference?",
    concept:
      "a split scene contrasting a finite product launch plan with an ongoing creator membership calendar",
  },
  "kickstarter-vs-gofundme": {
    title: "Kickstarter vs GoFundMe",
    concept:
      "a designed product prototype and reward package contrasted with a community support noticeboard",
  },
  "best-kickstarter-alternatives-2026": {
    title: "The Best Kickstarter Alternatives in 2026",
    concept:
      "branching paths leading from one creative prototype toward project funding, membership and community support",
  },
  "how-to-set-a-crowdfunding-goal": {
    title: "How to Set a Crowdfunding Goal",
    concept:
      "a creator calculating a project budget with material samples, a calculator and simple cost categories",
  },
  "reward-based-crowdfunding-explained": {
    title: "Reward-Based Crowdfunding Explained",
    concept: "a maker packaging a small early-edition reward beside a prototype and thank-you card",
  },
  "how-to-get-your-first-backers": {
    title: "How to Get Your First Backers",
    concept:
      "a small diverse group gathered around an early prototype while a creator demonstrates it",
  },
  "flexible-vs-all-or-nothing-crowdfunding": {
    title: "Flexible Funding vs All-or-Nothing Crowdfunding",
    concept:
      "two tactile paths, one a continuous stream of project support and one crossing a clear threshold gate",
  },
};

function corsHeaders(request: Request) {
  const requestOrigin = request.headers.get("Origin");
  const allowedOrigin =
    requestOrigin === productionOrigin || requestOrigin?.startsWith("http://localhost:")
      ? requestOrigin
      : productionOrigin;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

const json = (request: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });

const adminClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

function isWebp(bytes: Uint8Array) {
  return (
    bytes.length > 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json(request, { error: "Authentication required." }, 401);
  }

  const admin = adminClient();
  const { data: authData, error: authError } = await admin.auth.getUser(
    authorization.slice("Bearer ".length),
  );
  if (authError || authData.user?.id !== ownerAdminUserId) {
    return json(request, { error: "You do not have access to this action." }, 403);
  }

  let payload: { action?: unknown; slug?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json(request, { error: "Invalid request." }, 400);
  }

  const action = payload.action === "generate" ? "generate" : "status";
  if (action === "status") {
    const { data, error } = await admin
      .from("blog_images")
      .select("slug, status, generation_status, public_url, updated_at, generation_count")
      .order("slug");
    if (error) return json(request, { error: "Could not load blog image status." }, 500);
    return json(request, {
      images: data ?? [],
      openAiConfigured: Boolean(Deno.env.get("OPENAI_API_KEY")),
      model,
    });
  }

  const slug = typeof payload.slug === "string" ? payload.slug : "";
  const article = concepts[slug];
  if (!article) return json(request, { error: "Unknown published article." }, 422);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return json(request, { error: "OPENAI_API_KEY is not configured." }, 503);
  }

  const { data: jobToken, error: claimError } = await admin.rpc("claim_blog_image_generation", {
    p_slug: slug,
  });
  if (claimError) return json(request, { error: "Could not start image generation." }, 500);
  if (!jobToken) {
    return json(request, { error: "An image is already being generated for this article." }, 409);
  }

  try {
    const prompt = [
      "Create a premium editorial cover image for a crowdfunding publication.",
      `Subject: ${article.concept}.`,
      "Style: restrained contemporary editorial photography, clean composition, natural texture, credible and human, suitable for a mature consumer marketplace.",
      "Use Backed purple #5171ff only as a subtle accent, never as a full wash.",
      "No words, typography, numbers, logos, watermarks, screenshots, interface mockups, coins, rockets, megaphones, gradients, glassmorphism or generic SaaS illustration.",
      "Leave comfortable negative space and compose for a 16:9 article hero crop.",
    ].join(" ");

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        size: "1536x864",
        quality: "medium",
        output_format: "webp",
        output_compression: 85,
        n: 1,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) throw new Error(`openai_${response.status}`);
    const result = await response.json();
    const encoded = result?.data?.[0]?.b64_json;
    if (typeof encoded !== "string") throw new Error("openai_missing_image");

    const bytes = decodeBase64(encoded);
    if (bytes.length < 10_000 || bytes.length > 5_242_880 || !isWebp(bytes)) {
      throw new Error("openai_invalid_image");
    }

    const storagePath = `${slug}/cover.webp`;
    const { error: uploadError } = await admin.storage.from(bucket).upload(storagePath, bytes, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: true,
    });
    if (uploadError) throw new Error("storage_upload_failed");

    const stableUrl = admin.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
    const version = Date.now();
    const publicUrl = `${stableUrl}?v=${version}`;
    const { data: currentState } = await admin
      .from("blog_images")
      .select("generation_count")
      .eq("slug", slug)
      .single();
    const generationCount = Number(currentState?.generation_count ?? 0) + 1;
    const { error: updateError } = await admin
      .from("blog_images")
      .update({
        status: "ready",
        generation_status: "idle",
        public_url: publicUrl,
        storage_path: storagePath,
        updated_at: new Date().toISOString(),
        generation_count: generationCount,
        last_error_code: null,
      })
      .eq("slug", slug)
      .eq("job_token", jobToken);
    if (updateError) throw new Error("image_state_update_failed");

    return json(request, { slug, publicUrl, model });
  } catch (error) {
    const errorCode = error instanceof Error ? error.message.slice(0, 80) : "generation_failed";
    await admin
      .from("blog_images")
      .update({
        generation_status: "failed",
        updated_at: new Date().toISOString(),
        last_error_code: errorCode,
      })
      .eq("slug", slug)
      .eq("job_token", jobToken);
    console.error("Blog image generation failed", { slug, errorCode });
    return json(
      request,
      { error: "The editorial image could not be generated. Try again later." },
      502,
    );
  }
});
