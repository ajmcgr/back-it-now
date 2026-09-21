import { Download, Instagram, Linkedin, Link2, MessageCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { resolveProjectCover } from "@/lib/project-presentation";
import { shareUrls, trackShare, type ShareContext } from "@/lib/project-share";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PosterProject = {
  slug: string;
  name: string;
  summary: string;
  coverImage: string | null;
  creatorName: string;
  amountBacked: number;
  goal: number;
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount / 100);

const POSTER_WIDTH = 1200;
const POSTER_HEIGHT = 630;
const POSTER_IMAGE_WIDTH = 660;
const POSTER_CACHE_TTL = 60_000;
const posterCache = new Map<string, { createdAt: number; dataUrl: string }>();

type TextBlock = {
  lines: string[];
  fontSize: number;
  lineHeight: number;
};

function posterCacheKey(project: PosterProject) {
  return JSON.stringify(project);
}

function shortenLine(context: CanvasRenderingContext2D, line: string, maxWidth: number) {
  let shortened = line.trim();
  while (shortened && context.measureText(`${shortened}…`).width > maxWidth) {
    shortened = shortened.slice(0, -1).trimEnd();
  }
  return shortened ? `${shortened}…` : "…";
}

function wrapAtCurrentFont(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || context.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines;
}

function fitTextBlock(
  context: CanvasRenderingContext2D,
  text: string,
  {
    maxWidth,
    maxLines,
    preferredSize,
    minimumSize,
    weight,
    lineHeightRatio,
  }: {
    maxWidth: number;
    maxLines: number;
    preferredSize: number;
    minimumSize: number;
    weight: number;
    lineHeightRatio: number;
  },
): TextBlock {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return { lines: [], fontSize: preferredSize, lineHeight: 0 };

  for (let fontSize = preferredSize; fontSize >= minimumSize; fontSize -= 1) {
    context.font = `${weight} ${fontSize}px Inter, Arial, sans-serif`;
    const lines = wrapAtCurrentFont(context, normalized, maxWidth);
    if (
      lines.length <= maxLines &&
      lines.every((line) => context.measureText(line).width <= maxWidth)
    ) {
      return { lines, fontSize, lineHeight: Math.round(fontSize * lineHeightRatio) };
    }
  }

  context.font = `${weight} ${minimumSize}px Inter, Arial, sans-serif`;
  const lines = wrapAtCurrentFont(context, normalized, maxWidth).slice(0, maxLines);
  const consumed = lines.join(" ");
  if (consumed !== normalized && lines.length) {
    lines[lines.length - 1] = shortenLine(context, lines[lines.length - 1], maxWidth);
  }
  return {
    lines,
    fontSize: minimumSize,
    lineHeight: Math.round(minimumSize * lineHeightRatio),
  };
}

function drawTextBlock(
  context: CanvasRenderingContext2D,
  block: TextBlock,
  x: number,
  y: number,
  weight: number,
) {
  context.font = `${weight} ${block.fontSize}px Inter, Arial, sans-serif`;
  block.lines.forEach((line, index) => {
    context.fillText(line, x, y + index * block.lineHeight);
  });
  return y + block.lines.length * block.lineHeight;
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.width, height / image.height);
  const renderedWidth = image.width * scale;
  const renderedHeight = image.height * scale;
  context.drawImage(
    image,
    x + (width - renderedWidth) / 2,
    y + (height - renderedHeight) / 2,
    renderedWidth,
    renderedHeight,
  );
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

async function renderProjectPoster(project: PosterProject) {
  for (const [key, value] of posterCache) {
    if (Date.now() - value.createdAt >= POSTER_CACHE_TTL) posterCache.delete(key);
  }
  const cacheKey = posterCacheKey(project);
  const cached = posterCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < POSTER_CACHE_TTL) return cached.dataUrl;

  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Poster rendering is unavailable.");
  context.textBaseline = "top";
  context.fillStyle = "#fafaf9";
  context.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);

  try {
    const coverImage = resolveProjectCover({
      slug: project.slug,
      coverImage: project.coverImage,
    });
    if (!coverImage) throw new Error("Missing project cover.");
    const image = await loadImage(coverImage);
    drawCoverImage(context, image, 0, 0, POSTER_IMAGE_WIDTH, POSTER_HEIGHT);
  } catch {
    context.fillStyle = "#5171ff";
    context.fillRect(0, 0, POSTER_IMAGE_WIDTH, POSTER_HEIGHT);
    try {
      const mark = await loadImage("/favicon.png");
      context.globalAlpha = 0.22;
      drawCoverImage(context, mark, 210, 195, 240, 240);
      context.globalAlpha = 1;
    } catch {
      // The brand-color field remains a useful, intentional fallback.
    }
  }

  context.fillStyle = "#5171ff";
  context.fillRect(POSTER_IMAGE_WIDTH, 0, 8, POSTER_HEIGHT);

  const contentX = 712;
  const contentWidth = 436;

  try {
    const logo = await loadImage("/logo.png");
    const width = 180;
    context.drawImage(logo, contentX, 38, width, (logo.height / logo.width) * width);
  } catch {
    context.fillStyle = "#5171ff";
    context.font = "700 34px Inter, Arial, sans-serif";
    context.fillText("Backed", contentX, 42);
  }

  context.fillStyle = "#111111";
  const title = fitTextBlock(context, project.name, {
    maxWidth: contentWidth,
    maxLines: 2,
    preferredSize: 50,
    minimumSize: 36,
    weight: 700,
    lineHeightRatio: 1.05,
  });
  const titleBottom = drawTextBlock(context, title, contentX, 128, 700);

  context.fillStyle = "#5f6368";
  const summary = fitTextBlock(context, project.summary, {
    maxWidth: contentWidth,
    maxLines: 3,
    preferredSize: 27,
    minimumSize: 22,
    weight: 500,
    lineHeightRatio: 1.24,
  });
  const summaryBottom = drawTextBlock(context, summary, contentX, titleBottom + 16, 500);
  const fundingTop = Math.min(390, Math.max(310, summaryBottom + 42));

  context.fillStyle = "#111111";
  const backingAmount = fitTextBlock(context, `${money(project.amountBacked)} backed`, {
    maxWidth: contentWidth,
    maxLines: 1,
    preferredSize: 41,
    minimumSize: 30,
    weight: 700,
    lineHeightRatio: 1.05,
  });
  drawTextBlock(context, backingAmount, contentX, fundingTop, 700);
  context.fillStyle = "#5f6368";
  const funded = project.goal ? Math.round((project.amountBacked / project.goal) * 100) : 0;
  const fundingProgress = fitTextBlock(context, `${funded}% of ${money(project.goal)} goal`, {
    maxWidth: contentWidth,
    maxLines: 1,
    preferredSize: 21,
    minimumSize: 16,
    weight: 500,
    lineHeightRatio: 1.1,
  });
  drawTextBlock(context, fundingProgress, contentX, fundingTop + 51, 500);
  context.fillStyle = "#e1e1df";
  context.fillRect(contentX, fundingTop + 90, contentWidth, 14);
  context.fillStyle = "#5171ff";
  context.fillRect(
    contentX,
    fundingTop + 90,
    Math.min(contentWidth, Math.max(0, contentWidth * (funded / 100))),
    14,
  );

  context.fillStyle = "#111111";
  const creator = fitTextBlock(context, `by ${project.creatorName}`, {
    maxWidth: contentWidth,
    maxLines: 1,
    preferredSize: 21,
    minimumSize: 17,
    weight: 600,
    lineHeightRatio: 1.1,
  });
  drawTextBlock(context, creator, contentX, fundingTop + 136, 600);
  context.fillStyle = "#5171ff";
  context.font = "700 25px Inter, Arial, sans-serif";
  context.fillText("backedit.co", contentX, fundingTop + 184);

  const dataUrl = canvas.toDataURL("image/png");
  posterCache.set(cacheKey, { createdAt: Date.now(), dataUrl });
  return dataUrl;
}

export function ProjectPosterDialog({
  project,
  open,
  onOpenChange,
  context = "visitor",
}: {
  project: PosterProject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: ShareContext;
}) {
  const [poster, setPoster] = useState<string | null>(null);
  const [instagramHint, setInstagramHint] = useState(false);
  const links = shareUrls(project, context);
  useEffect(() => {
    if (!open) return;
    trackShare(project.slug, "share_opened", context);
    void renderProjectPoster(project)
      .then(setPoster)
      .catch(() => setPoster(null));
  }, [context, open, project]);
  const share = (href: string, event: string) => {
    trackShare(project.slug, event, context);
    window.open(href, "_blank", "noopener,noreferrer");
  };
  const download = () => {
    if (!poster) return;
    const anchor = document.createElement("a");
    anchor.href = poster;
    anchor.download = `backed-${project.slug}.png`;
    anchor.click();
    trackShare(project.slug, "share_poster_download", context);
  };
  const shareInstagram = async () => {
    trackShare(project.slug, "share_instagram", context);
    if (poster && navigator.canShare && navigator.share) {
      const blob = await fetch(poster).then((response) => response.blob());
      const file = new File([blob], `backed-${project.slug}.png`, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: project.name,
          text: links.copy,
          url: links.url,
        });
        return;
      }
    }
    if (navigator.clipboard) await navigator.clipboard.writeText(links.copy);
    download();
    setInstagramHint(true);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share project</DialogTitle>
          <DialogDescription>
            A 1200 × 630 Backed social poster, ready to download and share.
          </DialogDescription>
        </DialogHeader>
        {poster ? (
          <img
            src={poster}
            alt={`${project.name} social poster`}
            className="mt-3 w-full border border-border"
          />
        ) : (
          <div className="mt-3 aspect-[1200/630] animate-pulse bg-muted" />
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          <Button onClick={download} disabled={!poster}>
            <Download />
            Download poster
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              trackShare(project.slug, "share_copy_link", context);
              void navigator.clipboard.writeText(links.url);
            }}
          >
            <Link2 />
            Copy link
          </Button>
          <Button variant="outline" onClick={() => share(links.x, "share_x")}>
            <X />
            Share on X
          </Button>
          <Button variant="outline" onClick={() => share(links.reddit, "share_reddit")}>
            <span aria-hidden="true" className="font-bold">
              r/
            </span>
            Reddit
          </Button>
          <Button variant="outline" onClick={() => share(links.linkedin, "share_linkedin")}>
            <Linkedin />
            LinkedIn
          </Button>
          <Button variant="outline" onClick={() => share(links.whatsapp, "share_whatsapp")}>
            <MessageCircle />
            WhatsApp
          </Button>
          <Button variant="outline" onClick={() => void shareInstagram()}>
            <Instagram />
            Instagram
          </Button>
        </div>
        {instagramHint && (
          <p className="text-sm text-muted-foreground">
            Poster ready. Share it to Instagram and add your Backed link.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
