import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const textModel = "gpt-6-luna";
const imageModel = "gpt-image-2.5-flare";
const imageBucket = "blog-images";

const launchArticles = [
  {
    slug: "how-to-crowdfund-a-project-in-2026",
    title: "How to Crowdfund a Project in 2026",
    concept:
      "an independent creator planning a launch with sketches, a prototype and a simple campaign checklist",
  },
  {
    slug: "kickstarter-vs-patreon",
    title: "Kickstarter vs Patreon: What’s the Difference?",
    concept:
      "a split scene contrasting a finite product launch plan with an ongoing creator membership calendar",
  },
  {
    slug: "kickstarter-vs-gofundme",
    title: "Kickstarter vs GoFundMe",
    concept:
      "a designed product prototype and reward package contrasted with a community support noticeboard",
  },
  {
    slug: "best-kickstarter-alternatives-2026",
    title: "The Best Kickstarter Alternatives in 2026",
    concept:
      "branching paths leading from one creative prototype toward project funding, membership and community support",
  },
  {
    slug: "how-to-set-a-crowdfunding-goal",
    title: "How to Set a Crowdfunding Goal",
    concept:
      "a creator calculating a project budget with material samples, a calculator and simple cost categories",
  },
  {
    slug: "reward-based-crowdfunding-explained",
    title: "Reward-Based Crowdfunding Explained",
    concept: "a maker packaging a small early-edition reward beside a prototype and thank-you card",
  },
  {
    slug: "how-to-get-your-first-backers",
    title: "How to Get Your First Backers",
    concept:
      "a small diverse group gathered around an early prototype while a creator demonstrates it",
  },
  {
    slug: "flexible-vs-all-or-nothing-crowdfunding",
    title: "Flexible Funding vs All-or-Nothing Crowdfunding",
    concept:
      "two tactile paths, one a continuous stream of project support and one crossing a clear threshold gate",
  },
] as const;

const articleSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 12, maxLength: 120 },
    description: { type: "string", minLength: 50, maxLength: 220 },
    excerpt: { type: "string", minLength: 50, maxLength: 260 },
    category: {
      type: "string",
      enum: ["Crowdfunding", "Guides", "Comparisons", "Ideas"],
    },
    read_minutes: { type: "integer", minimum: 3, maximum: 20 },
    image_concept: { type: "string", minLength: 30, maxLength: 500 },
    sections: {
      type: "array",
      minItems: 5,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          heading: { type: "string", minLength: 4, maxLength: 100 },
          paragraphs: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: { type: "string", minLength: 80, maxLength: 900 },
          },
          bullets: {
            type: "array",
            maxItems: 5,
            items: { type: "string", minLength: 15, maxLength: 220 },
          },
        },
        required: ["heading", "paragraphs", "bullets"],
      },
    },
    related_links: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string", minLength: 3, maxLength: 100 },
          href: { type: "string", minLength: 1, maxLength: 240 },
        },
        required: ["label", "href"],
      },
    },
    sources: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string", minLength: 3, maxLength: 120 },
          href: { type: "string", minLength: 8, maxLength: 500 },
        },
        required: ["label", "href"],
      },
    },
  },
  required: [
    "title",
    "description",
    "excerpt",
    "category",
    "read_minutes",
    "image_concept",
    "sections",
    "related_links",
    "sources",
  ],
} as const;

type GeneratedArticle = {
  title: string;
  description: string;
  excerpt: string;
  category: "Crowdfunding" | "Guides" | "Comparisons" | "Ideas";
  read_minutes: number;
  image_concept: string;
  sections: Array<{ heading: string; paragraphs: string[]; bullets: string[] }>;
  related_links: Array<{ label: string; href: string }>;
  sources: Array<{ label: string; href: string }>;
};

const adminClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

function safeErrorCode(error: unknown) {
  const value = error instanceof Error ? error.message : "generation_failed";
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100) || "generation_failed";
}

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

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/-+$/g, "");
}

function responseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: unknown }).type === "output_text" &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        return (part as { text: string }).text;
      }
    }
  }
  return "";
}

function validateArticle(value: unknown): GeneratedArticle {
  if (!value || typeof value !== "object") throw new Error("invalid_article_shape");
  const article = value as GeneratedArticle;
  const categories = new Set(["Crowdfunding", "Guides", "Comparisons", "Ideas"]);
  const strings = [article.title, article.description, article.excerpt, article.image_concept];
  if (strings.some((item) => typeof item !== "string" || /<[^>]+>/.test(item))) {
    throw new Error("invalid_article_text");
  }
  if (!categories.has(article.category)) throw new Error("invalid_article_category");
  if (
    !Number.isInteger(article.read_minutes) ||
    article.read_minutes < 3 ||
    article.read_minutes > 20
  ) {
    throw new Error("invalid_read_time");
  }
  if (
    !Array.isArray(article.sections) ||
    article.sections.length < 5 ||
    article.sections.length > 7
  ) {
    throw new Error("invalid_article_sections");
  }
  const paragraphs = article.sections.flatMap((section) => section.paragraphs ?? []);
  if (paragraphs.some((paragraph) => typeof paragraph !== "string" || /<[^>]+>/.test(paragraph))) {
    throw new Error("invalid_article_paragraph");
  }
  const wordCount = paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 750 || wordCount > 1800) throw new Error("invalid_article_length");
  if (
    !Array.isArray(article.related_links) ||
    article.related_links.some(
      (link) =>
        typeof link?.label !== "string" ||
        typeof link?.href !== "string" ||
        !link.href.startsWith("/") ||
        link.href.startsWith("//"),
    )
  ) {
    throw new Error("invalid_related_links");
  }
  if (
    !Array.isArray(article.sources) ||
    article.sources.some(
      (source) =>
        typeof source?.label !== "string" ||
        typeof source?.href !== "string" ||
        !source.href.startsWith("https://"),
    )
  ) {
    throw new Error("invalid_sources");
  }
  return article;
}

async function generateImage(apiKey: string, concept: string) {
  const prompt = [
    "Create a premium editorial cover image for the Backed crowdfunding publication.",
    `Subject: ${concept}.`,
    "Style: restrained contemporary editorial photography, clean composition, natural texture, credible and human, suitable for a mature consumer marketplace.",
    "Use Backed purple #5171ff only as a subtle accent, never as a full wash.",
    "No words, typography, numbers, logos, watermarks, screenshots, interface mockups, coins, rockets, megaphones, gradients, glassmorphism or generic SaaS illustration.",
    "Leave comfortable negative space and compose for a 16:9 article hero crop.",
  ].join(" ");

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: imageModel,
      prompt,
      size: "1536x864",
      quality: "medium",
      output_format: "webp",
      output_compression: 85,
      n: 1,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`openai_image_${response.status}`);
  const result = await response.json();
  const encoded = result?.data?.[0]?.b64_json;
  if (typeof encoded !== "string") throw new Error("openai_missing_image");
  const bytes = decodeBase64(encoded);
  if (bytes.length < 10_000 || bytes.length > 5_242_880 || !isWebp(bytes)) {
    throw new Error("openai_invalid_image");
  }
  return bytes;
}

async function uploadImage(admin: ReturnType<typeof adminClient>, slug: string, bytes: Uint8Array) {
  const storagePath = `${slug}/cover.webp`;
  const { error } = await admin.storage.from(imageBucket).upload(storagePath, bytes, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) throw new Error("storage_upload_failed");
  const stableUrl = admin.storage.from(imageBucket).getPublicUrl(storagePath).data.publicUrl;
  return { storagePath, publicUrl: `${stableUrl}?v=${Date.now()}` };
}

async function generateArticle(apiKey: string, existingTitles: string[]) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: textModel,
      reasoning: { effort: "medium" },
      max_output_tokens: 7000,
      tools: [{ type: "web_search" }],
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You are the editorial writer for Backed, a simple reward and preorder crowdfunding marketplace.",
                "Write a genuinely useful, original, evergreen article for independent creators or backers.",
                "Backed uses flexible funding: successful backings are charged immediately, creators may receive proceeds without reaching the visible goal, rewards are optional, and Backed charges creators 5% plus payment processing.",
                "Never describe Backed as all-or-nothing, an investment platform, or a donation platform.",
                "Use a direct editorial voice. Avoid marketing fluff, fabricated anecdotes, fake statistics, em dashes used excessively, and claims that cannot be supported.",
                "Use web search for any current platform, fee, legal, or market claim. Put only authoritative HTTPS sources actually used into sources. Evergreen advice may have an empty sources array.",
                "Do not use HTML or Markdown in any field. Bullets are plain sentences. Internal related links must begin with a single slash.",
                "Create 5 to 7 substantial sections and 750 to 1,800 words of paragraph copy in total.",
              ].join(" "),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Generate the next Backed article. Choose a topic with clear search intent that complements rather than repeats the existing library.",
                `Existing article titles: ${existingTitles.join(" | ")}.`,
                "Useful internal destinations include /discover, /start, /pricing, /faq, /compare, and existing blog slugs when contextually relevant.",
                "The image concept must describe an editorial photograph or tactile still life without text or logos.",
              ].join(" "),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "backed_blog_article",
          strict: true,
          schema: articleSchema,
        },
      },
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) throw new Error(`openai_text_${response.status}`);
  const payload = await response.json();
  const generatedText = responseText(payload);
  if (!generatedText) throw new Error("openai_missing_article");
  try {
    return validateArticle(JSON.parse(generatedText));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("openai_invalid_json");
    throw error;
  }
}

async function handleBackfill(admin: ReturnType<typeof adminClient>, apiKey: string) {
  const { data: existing, error } = await admin
    .from("blog_images")
    .select("slug, status, public_url");
  if (error) throw new Error("image_state_unavailable");
  const ready = new Set(
    (existing ?? [])
      .filter((row) => row.status === "ready" && row.public_url)
      .map((row) => row.slug),
  );
  const candidate = launchArticles.find((article) => !ready.has(article.slug));
  if (!candidate) {
    await admin.rpc("stop_blog_image_backfill");
    return { complete: true };
  }

  const { data: jobToken, error: claimError } = await admin.rpc("claim_blog_image_generation", {
    p_slug: candidate.slug,
  });
  if (claimError) throw new Error("image_claim_failed");
  if (!jobToken) return { complete: false, busy: true };

  try {
    const bytes = await generateImage(apiKey, candidate.concept);
    const uploaded = await uploadImage(admin, candidate.slug, bytes);
    const { data: current } = await admin
      .from("blog_images")
      .select("generation_count")
      .eq("slug", candidate.slug)
      .single();
    const { error: updateError } = await admin
      .from("blog_images")
      .update({
        status: "ready",
        generation_status: "idle",
        public_url: uploaded.publicUrl,
        storage_path: uploaded.storagePath,
        updated_at: new Date().toISOString(),
        generation_count: Number(current?.generation_count ?? 0) + 1,
        last_error_code: null,
      })
      .eq("slug", candidate.slug)
      .eq("job_token", jobToken);
    if (updateError) throw new Error("image_state_update_failed");
    if (ready.size + 1 >= launchArticles.length) await admin.rpc("stop_blog_image_backfill");
    return { complete: ready.size + 1 >= launchArticles.length, slug: candidate.slug };
  } catch (error) {
    const errorCode = safeErrorCode(error);
    await admin
      .from("blog_images")
      .update({
        generation_status: "failed",
        updated_at: new Date().toISOString(),
        last_error_code: errorCode,
      })
      .eq("slug", candidate.slug)
      .eq("job_token", jobToken);
    throw error;
  }
}

async function handleWeekly(admin: ReturnType<typeof adminClient>, apiKey: string) {
  const { data: jobToken, error: claimError } = await admin.rpc("claim_weekly_blog_publication");
  if (claimError) throw new Error("article_claim_failed");
  if (!jobToken) return { due: false };

  try {
    const { data: generatedArticles, error } = await admin
      .from("blog_articles")
      .select("slug, title")
      .neq("status", "archived")
      .order("published_at", { ascending: false });
    if (error) throw new Error("article_library_unavailable");

    const existingTitles = [
      ...launchArticles.map((article) => article.title),
      ...(generatedArticles ?? []).map((article) => article.title),
    ];
    const existingSlugs = new Set([
      ...launchArticles.map((article) => article.slug),
      ...(generatedArticles ?? []).map((article) => article.slug),
    ]);
    const article = await generateArticle(apiKey, existingTitles);
    let slug = slugify(article.title);
    if (!slug) throw new Error("invalid_article_slug");
    if (existingSlugs.has(slug)) slug = `${slug}-${new Date().toISOString().slice(0, 10)}`;

    const bytes = await generateImage(apiKey, article.image_concept);
    const uploaded = await uploadImage(admin, slug, bytes);
    const publishedAt = new Date().toISOString();
    const { data: articleId, error: publishError } = await admin.rpc(
      "publish_weekly_blog_article",
      {
        p_job_token: jobToken,
        p_article: {
          ...article,
          slug,
          published_at: publishedAt,
          image_url: uploaded.publicUrl,
          image_storage_path: uploaded.storagePath,
          text_model: textModel,
          image_model: imageModel,
        },
      },
    );
    if (publishError || !articleId) throw new Error("article_publish_failed");
    return { due: true, published: true, slug };
  } catch (error) {
    const errorCode = safeErrorCode(error);
    await admin.rpc("fail_weekly_blog_publication", {
      p_job_token: jobToken,
      p_error_code: errorCode,
    });
    throw error;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const admin = adminClient();
  const suppliedSecret = request.headers.get("x-blog-automation-secret");
  const { data: authorized, error: authError } = await admin.rpc("verify_blog_automation_secret", {
    p_secret: suppliedSecret ?? "",
  });
  if (authError || authorized !== true) return json({ error: "Unauthorized." }, 401);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "OpenAI is not configured." }, 503);

  let payload: { mode?: unknown } = {};
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const mode = payload.mode === "backfill" ? "backfill" : payload.mode === "weekly" ? "weekly" : "";
  if (!mode) return json({ error: "Invalid automation mode." }, 422);

  try {
    const result =
      mode === "backfill" ? await handleBackfill(admin, apiKey) : await handleWeekly(admin, apiKey);
    console.log("Backed blog automation completed", { mode, ...result });
    return json(result);
  } catch (error) {
    const errorCode = safeErrorCode(error);
    console.error("Backed blog automation failed", { mode, errorCode });
    return json({ error: "Blog automation did not complete.", errorCode }, 502);
  }
});
